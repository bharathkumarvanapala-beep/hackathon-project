#!/usr/bin/env node
/**
 * Aarogya Drishti — CLI Synthetic Cohort Generator
 *
 * Generates synthetic patient cohorts with zero PII for testing, training,
 * and edge sync benchmarks.
 *
 * Usage:
 *   node scripts/generate-synthetic-cohort.mjs --count 10
 *   node scripts/generate-synthetic-cohort.mjs --count 5 --seed
 */

import { generateSyntheticCohort } from '../src/synthetic-data.mjs';
import { openStore, transaction, recordConsent, putEvent, audit } from '../src/store.mjs';
import { loadConfig } from '../src/config.mjs';
import { parseDataUrl, storePatientImage } from '../src/image-storage.mjs';

const args = process.argv.slice(2);
const countIndex = args.indexOf('--count');
const count = countIndex !== -1 && args[countIndex + 1] ? parseInt(args[countIndex + 1], 10) : 5;
const shouldSeed = args.includes('--seed');

console.log(`Generating ${count} synthetic patient records for ITDA Paderu...`);
const cohort = generateSyntheticCohort(count);

if (shouldSeed) {
  const config = loadConfig();
  const db = openStore(config.paths.dataDir);
  const workerUser = db.prepare("SELECT * FROM users WHERE role = 'worker' LIMIT 1").get();
  if (!workerUser) {
    console.error('Error: No worker account found in database. Start the server once first.');
    process.exit(1);
  }

  let seededCount = 0;
  for (const patient of cohort) {
    const existing = db.prepare('SELECT id FROM patients WHERE id = ?').get(patient.id);
    if (existing) continue;

    transaction(db, () => {
      // Insert patient row first to satisfy foreign key constraint in images table
      db.prepare('INSERT INTO patients VALUES(?, ?, ?, ?, ?)').run(
        patient.id,
        JSON.stringify(patient),
        1,
        workerUser.id,
        patient.createdAt
      );

      // Decouple photo if present
      if (patient.photo) {
        try {
          const { buffer, mimeHint } = parseDataUrl(patient.photo);
          const savedImage = storePatientImage(db, {
            patientId: patient.id,
            buffer,
            mimeHint,
            uploadedBy: workerUser.id,
            storageDir: config.paths.storageDir
          });
          patient.photo = savedImage.url;
          patient.imageId = savedImage.id;
          db.prepare('UPDATE patients SET body = ? WHERE id = ?').run(
            JSON.stringify(patient),
            patient.id
          );
        } catch (err) {
          console.warn(`Warning: photo storage failed for ${patient.id}: ${err.message}`);
        }
      }

      recordConsent(db, {
        patientId: patient.id,
        version: patient.consentVersion,
        language: patient.consentLanguage,
        termsText: patient.consentText,
        userId: workerUser.id
      });

      putEvent(db, 'screening.created', patient);
      audit(db, workerUser, 'synthetic.seeded', patient.id);
      seededCount++;
    });
  }

  console.log(`Successfully seeded ${seededCount} synthetic patients into ${config.paths.dataDir}/drishti.sqlite`);
  db.close();
} else {
  console.log(JSON.stringify(cohort, null, 2));
}
