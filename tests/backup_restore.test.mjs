import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { existsSync, writeFileSync } from 'node:fs';
import { openStore } from '../src/store.mjs';
import { createBackup, verifyBackup, restoreBackup } from '../scripts/backup-restore.mjs';

test('Operational Backup & Disaster Recovery: WAL flush, cryptographic checksums, tampering detection, and faithful restore', async () => {
  const sourceDataDir = await mkdtemp(join(tmpdir(), 'drishti-backup-src-'));
  const sourceStorageDir = join(sourceDataDir, 'storage');
  const backupParentDir = await mkdtemp(join(tmpdir(), 'drishti-backup-dest-'));
  const restoreTargetDataDir = await mkdtemp(join(tmpdir(), 'drishti-backup-target-'));
  const restoreTargetStorageDir = join(restoreTargetDataDir, 'storage');

  // 1. Setup active source database with sample patients and images
  const db = openStore(sourceDataDir);
  const now = new Date().toISOString();

  // Insert 3 test patients
  const workerUser = db.prepare('SELECT id FROM users LIMIT 1;').get().id;
  for (let i = 1; i <= 3; i++) {
    const p = {
      id: `AD-BACKUP-TEST-${i}`,
      name: `Backup Patient ${i}`,
      age: 30 + i,
      village: 'Araku',
      history: 'Disaster recovery validation',
      consent: true,
      stage: i === 1 ? 'referred' : 'screened',
      createdAt: now,
      timeline: []
    };
    db.prepare('INSERT INTO patients VALUES(?,?,?,?,?)').run(
      p.id,
      JSON.stringify(p),
      1,
      workerUser,
      now
    );
  }


  // Create a decoupled image file and index it in the images table
  const imagesDir = join(sourceStorageDir, 'images');
  import('node:fs');
  const { mkdirSync } = await import('node:fs');
  mkdirSync(imagesDir, { recursive: true });
  const testImageBuffer = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9
  ]);
  const testImageName = 'IMG-BACKUP-01.jpg';
  const testImagePath = join(imagesDir, testImageName);
  writeFileSync(testImagePath, testImageBuffer);

  db.prepare(`
    INSERT INTO images(id, patient_id, sha256, file_path, mime_type, file_size, uploaded_by, created_at)
    VALUES(?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'IMG-BACKUP-01',
    'AD-BACKUP-TEST-1',
    'testsha256',
    'images/' + testImageName,
    'image/jpeg',
    testImageBuffer.length,
    workerUser,
    now
  );


  db.close();

  // 2. Perform atomic backup
  const backupResult = createBackup({
    dataDir: sourceDataDir,
    storageDir: sourceStorageDir,
    destinationDir: backupParentDir
  });

  assert.equal(backupResult.success, true);
  assert.ok(existsSync(backupResult.backupPath), 'Backup folder must exist on disk');
  assert.equal(backupResult.metadata.counts.patients, 3, 'Must record exactly 3 patients');
  assert.ok(backupResult.metadata.files['drishti.sqlite'], 'Manifest must record drishti.sqlite');
  assert.ok(
    backupResult.metadata.files['drishti.sqlite'].sha256.length === 64,
    'SHA-256 must be 64-char hex'
  );
  assert.equal(
    backupResult.metadata.images.length,
    1,
    'Must include the decoupled oral image file'
  );

  // 3. Verify legitimate backup
  const verifyResult = verifyBackup(backupResult.backupPath);
  assert.equal(verifyResult.valid, true, 'Clean backup must pass integrity check');
  assert.ok(verifyResult.checkedFiles >= 2);

  // 4. Tampering detection: Alter 1 byte in the backup database
  const tamperedBackupResult = createBackup({
    dataDir: sourceDataDir,
    storageDir: sourceStorageDir,
    destinationDir: backupParentDir
  });

  const tamperedDbFile = join(tamperedBackupResult.backupPath, 'drishti.sqlite');
  const originalBytes = await readFile(tamperedDbFile);
  // Modify a non-header byte to simulate silent disk bit-rot or tampering
  originalBytes[originalBytes.length - 1] ^= 0xff;
  await writeFile(tamperedDbFile, originalBytes);

  assert.throws(
    () => {
      verifyBackup(tamperedBackupResult.backupPath);
    },
    /SHA-256 checksum mismatch|integrity/i,
    'Tampered backup must be rejected by SHA-256 verification'
  );

  // 5. Restore from verified backup into a fresh destination directory
  const restoreResult = restoreBackup({
    backupDir: backupResult.backupPath,
    targetDataDir: restoreTargetDataDir,
    targetStorageDir: restoreTargetStorageDir,
    force: true
  });

  assert.equal(restoreResult.success, true);
  assert.ok(
    existsSync(join(restoreTargetDataDir, 'drishti.sqlite')),
    'Restored drishti.sqlite must exist'
  );
  assert.ok(
    existsSync(join(restoreTargetStorageDir, 'images', testImageName)),
    'Restored image must exist in storage/images'
  );

  // 6. Verify restored database records and integrity
  const restoredDb = new DatabaseSync(join(restoreTargetDataDir, 'drishti.sqlite'));
  const patientCount = restoredDb.prepare('SELECT count(*) as c FROM patients;').get().c;
  assert.equal(patientCount, 3, 'All 3 patients must be present after restoration');

  const p1 = restoredDb
    .prepare('SELECT body FROM patients WHERE id=?')
    .get('AD-BACKUP-TEST-1');
  assert.ok(p1, 'AD-BACKUP-TEST-1 must exist');
  assert.equal(JSON.parse(p1.body).village, 'Araku');

  const integrityRow = restoredDb.prepare('PRAGMA integrity_check;').get();
  assert.equal(Object.values(integrityRow)[0], 'ok', 'Restored database must be 100% healthy');
  restoredDb.close();
});
