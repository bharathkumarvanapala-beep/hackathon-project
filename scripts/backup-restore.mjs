#!/usr/bin/env node
/**
 * Aarogya Drishti — Operational Backup & Restore Utility
 *
 * Provides atomic, verified backup and disaster recovery for rural clinical operations:
 * 1. Flushes SQLite WAL journals via PRAGMA wal_checkpoint(TRUNCATE).
 * 2. Executes PRAGMA integrity_check to verify database health before and after.
 * 3. Backs up SQLite database, demo accounts, and decoupled image storage.
 * 4. Generates cryptographic SHA-256 manifests (backup-metadata.json).
 * 5. Supports dry-run verification and automatic safety snapshots prior to restore.
 */

import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import {
  cpSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  statSync,
  existsSync
} from 'node:fs';
import { resolve, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../src/config.mjs';

const __filename = fileURLToPath(import.meta.url);

export function computeFileSha256(filePath) {
  if (!existsSync(filePath)) return null;
  const buffer = readFileSync(filePath);
  return createHash('sha256').update(buffer).digest('hex');
}

/**
 * Creates an atomic, timestamped backup of the database and image store.
 */
export function createBackup({
  dataDir,
  storageDir,
  destinationDir = 'backups'
} = {}) {
  const config = loadConfig();
  const srcDataDir = resolve(dataDir || config.paths.dataDir);
  const srcStorageDir = resolve(storageDir || config.paths.storageDir);
  const dbPath = join(srcDataDir, 'drishti.sqlite');

  if (!existsSync(dbPath)) {
    throw new Error(`Database file not found at ${dbPath}`);
  }

  // 1. WAL Checkpoint & Integrity Check on active database
  let db;
  let counts = { patients: 0, referrals: 0, images: 0, clinicalReviews: 0 };
  try {
    db = new DatabaseSync(dbPath);
    // Flush dirty WAL pages to main DB file
    db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
    const integrityRow = db.prepare('PRAGMA integrity_check;').get();
    const integrityStatus = integrityRow ? Object.values(integrityRow)[0] : 'ok';
    if (integrityStatus !== 'ok') {
      throw new Error(`Database integrity check failed: ${integrityStatus}`);
    }

    try {
      counts.patients = db.prepare('SELECT count(*) as c FROM patients;').get()?.c || 0;
    } catch {}
    try {
      counts.referrals = db.prepare('SELECT count(*) as c FROM referrals;').get()?.c || 0;
    } catch {}
    try {
      counts.images = db.prepare('SELECT count(*) as c FROM images;').get()?.c || 0;
    } catch {}
    try {
      counts.clinicalReviews =
        db.prepare('SELECT count(*) as c FROM clinical_reviews;').get()?.c || 0;
    } catch {}
  } finally {
    if (db) db.close();
  }

  // 2. Prepare timestamped backup directory
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const ms = String(now.getUTCMilliseconds()).padStart(3, '0');
  const timestamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(
    now.getUTCDate()
  )}-${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}-${ms}`;
  const backupFolderName = `backup-${timestamp}`;

  const backupPath = resolve(destinationDir, backupFolderName);
  mkdirSync(backupPath, { recursive: true });

  const metadata = {
    schema: 1,
    createdAt: now.toISOString(),
    version: '0.3.0',
    platform: 'Aarogya Drishti · ITDA Paderu',
    counts,
    files: {},
    images: []
  };

  // 3. Copy database
  const destDbPath = join(backupPath, 'drishti.sqlite');
  cpSync(dbPath, destDbPath);
  metadata.files['drishti.sqlite'] = {
    size: statSync(destDbPath).size,
    sha256: computeFileSha256(destDbPath)
  };

  // 4. Copy demo-accounts.json if present
  const accountsPath = join(srcDataDir, 'demo-accounts.json');
  if (existsSync(accountsPath)) {
    const destAccountsPath = join(backupPath, 'demo-accounts.json');
    cpSync(accountsPath, destAccountsPath);
    metadata.files['demo-accounts.json'] = {
      size: statSync(destAccountsPath).size,
      sha256: computeFileSha256(destAccountsPath)
    };
  }

  // 5. Copy decoupled image directory
  const imagesSrcDir = join(srcStorageDir, 'images');
  const imagesDestDir = join(backupPath, 'storage', 'images');
  if (existsSync(imagesSrcDir)) {
    mkdirSync(imagesDestDir, { recursive: true });
    const imageFiles = readdirSync(imagesSrcDir);
    for (const file of imageFiles) {
      const srcFile = join(imagesSrcDir, file);
      if (statSync(srcFile).isFile()) {
        const destFile = join(imagesDestDir, file);
        cpSync(srcFile, destFile);
        metadata.images.push({
          name: file,
          size: statSync(destFile).size,
          sha256: computeFileSha256(destFile)
        });
      }
    }
  }

  // 6. Write backup metadata manifest
  const metadataPath = join(backupPath, 'backup-metadata.json');
  writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf8');

  return {
    success: true,
    backupPath,
    backupFolderName,
    metadata
  };
}

/**
 * Validates a backup directory against its cryptographic manifest and checks SQLite integrity.
 */
export function verifyBackup(backupDir) {
  const dir = resolve(backupDir);
  const metadataPath = join(dir, 'backup-metadata.json');
  if (!existsSync(metadataPath)) {
    throw new Error(`Missing backup-metadata.json in ${dir}`);
  }

  const metadata = JSON.parse(readFileSync(metadataPath, 'utf8'));

  // 1. Verify core files
  for (const [filename, fileMeta] of Object.entries(metadata.files || {})) {
    const filePath = join(dir, filename);
    if (!existsSync(filePath)) {
      throw new Error(`Missing file in backup: ${filename}`);
    }
    const currentSha256 = computeFileSha256(filePath);
    if (currentSha256 !== fileMeta.sha256) {
      throw new Error(
        `SHA-256 checksum mismatch for ${filename}. Expected ${fileMeta.sha256}, got ${currentSha256}`
      );
    }
  }

  // 2. Verify images
  for (const imgMeta of metadata.images || []) {
    const imgPath = join(dir, 'storage', 'images', imgMeta.name);
    if (!existsSync(imgPath)) {
      throw new Error(`Missing image in backup: ${imgMeta.name}`);
    }
    const currentSha256 = computeFileSha256(imgPath);
    if (currentSha256 !== imgMeta.sha256) {
      throw new Error(
        `SHA-256 checksum mismatch for image ${imgMeta.name}. Expected ${imgMeta.sha256}, got ${currentSha256}`
      );
    }
  }

  // 3. SQLite database integrity check
  const dbPath = join(dir, 'drishti.sqlite');
  let db;
  try {
    db = new DatabaseSync(dbPath, { readOnly: true });
    const integrityRow = db.prepare('PRAGMA integrity_check;').get();
    const status = integrityRow ? Object.values(integrityRow)[0] : 'ok';
    if (status !== 'ok') {
      throw new Error(`Backup database integrity failed: ${status}`);
    }
  } finally {
    if (db) db.close();
  }

  return {
    valid: true,
    metadata,
    checkedFiles: Object.keys(metadata.files).length + (metadata.images?.length || 0)
  };
}

/**
 * Restores a database and image repository from a verified backup directory.
 */
export function restoreBackup({
  backupDir,
  targetDataDir,
  targetStorageDir,
  force = false
} = {}) {
  const config = loadConfig();
  const destDataDir = resolve(targetDataDir || config.paths.dataDir);
  const destStorageDir = resolve(targetStorageDir || config.paths.storageDir);

  // 1. Always verify the backup before touching destination
  const verifyResult = verifyBackup(backupDir);
  if (!verifyResult.valid) {
    throw new Error('Cannot restore: backup verification failed.');
  }

  mkdirSync(destDataDir, { recursive: true });
  mkdirSync(destStorageDir, { recursive: true });

  const activeDbPath = join(destDataDir, 'drishti.sqlite');

  // 2. Create safety snapshot if active database exists and not forced
  let safetySnapshotPath = null;
  if (existsSync(activeDbPath) && !force) {
    const safetyFolderName = `safety-snapshot-before-restore-${Date.now()}`;
    safetySnapshotPath = join(destDataDir, '..', 'backups', safetyFolderName);
    createBackup({
      dataDir: destDataDir,
      storageDir: destStorageDir,
      destinationDir: join(destDataDir, '..', 'backups')
    });
  }

  // 3. Restore files
  const dir = resolve(backupDir);
  const srcDbPath = join(dir, 'drishti.sqlite');
  cpSync(srcDbPath, activeDbPath);

  const srcAccountsPath = join(dir, 'demo-accounts.json');
  if (existsSync(srcAccountsPath)) {
    cpSync(srcAccountsPath, join(destDataDir, 'demo-accounts.json'));
  }

  const srcImagesDir = join(dir, 'storage', 'images');
  const destImagesDir = join(destStorageDir, 'images');
  if (existsSync(srcImagesDir)) {
    mkdirSync(destImagesDir, { recursive: true });
    cpSync(srcImagesDir, destImagesDir, { recursive: true });
  }

  // 4. Post-restore integrity verification
  let db;
  try {
    db = new DatabaseSync(activeDbPath);
    const integrityRow = db.prepare('PRAGMA integrity_check;').get();
    const status = integrityRow ? Object.values(integrityRow)[0] : 'ok';
    if (status !== 'ok') {
      throw new Error(`Restored database integrity failed: ${status}`);
    }
  } finally {
    if (db) db.close();
  }

  return {
    success: true,
    restoredAt: new Date().toISOString(),
    safetySnapshotCreated: Boolean(safetySnapshotPath),
    metadata: verifyResult.metadata
  };
}

// CLI Execution entry point
if (process.argv[1] && resolve(process.argv[1]) === resolve(__filename)) {
  const [,, command, targetArg] = process.argv;

  if (command === 'backup') {
    const dest = targetArg || 'backups';
    console.log(`[BACKUP] Starting backup into ${dest}...`);
    try {
      const result = createBackup({ destinationDir: dest });
      console.log(`[BACKUP] ✓ Success! Created ${result.backupFolderName}`);
      console.log(`[BACKUP] Path: ${result.backupPath}`);
      console.log(`[BACKUP] Patients: ${result.metadata.counts.patients}, Referrals: ${result.metadata.counts.referrals}, Images: ${result.metadata.images.length}`);
      process.exit(0);
    } catch (err) {
      console.error(`[BACKUP] ✕ Failed: ${err.message}`);
      process.exit(1);
    }
  } else if (command === 'verify') {
    if (!targetArg) {
      console.error('[VERIFY] Error: specify backup directory to verify.');
      process.exit(1);
    }
    console.log(`[VERIFY] Verifying backup ${targetArg}...`);
    try {
      const res = verifyBackup(targetArg);
      console.log(`[VERIFY] ✓ Valid! Verified ${res.checkedFiles} files.`);
      console.log(`[VERIFY] Created at: ${res.metadata.createdAt}`);
      process.exit(0);
    } catch (err) {
      console.error(`[VERIFY] ✕ Verification failed: ${err.message}`);
      process.exit(1);
    }
  } else if (command === 'restore') {
    if (!targetArg) {
      console.error('[RESTORE] Error: specify backup directory to restore from.');
      process.exit(1);
    }
    console.log(`[RESTORE] Restoring from ${targetArg}...`);
    try {
      const res = restoreBackup({ backupDir: targetArg });
      console.log(`[RESTORE] ✓ Restored successfully at ${res.restoredAt}!`);
      process.exit(0);
    } catch (err) {
      console.error(`[RESTORE] ✕ Restore failed: ${err.message}`);
      process.exit(1);
    }
  } else {
    console.log(`
Aarogya Drishti — Backup & Disaster Recovery CLI

Usage:
  node scripts/backup-restore.mjs backup [destinationDir]   Create a verified backup
  node scripts/backup-restore.mjs verify <backupDir>        Verify checksums & SQLite integrity
  node scripts/backup-restore.mjs restore <backupDir>       Restore database & images from backup
    `);
    process.exit(0);
  }
}
