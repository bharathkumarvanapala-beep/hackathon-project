#!/usr/bin/env node
/**
 * Aarogya Drishti — CLI Synthetic Cohort & Multi-Stage Workflow Generator
 *
 * Generates and seeds mathematically synthetic, non-PII tribal oral health cohorts
 * across all ITDA Paderu Agency Mandals and populates realistic clinical progression
 * (AI vision analyses, doctor reviews, facility referrals including overdue follow-ups,
 * biopsy/pathology investigations, WebRTC teleconsultations, and navigation logs).
 *
 * Usage:
 *   node scripts/generate-synthetic-cohort.mjs --count 10
 *   node scripts/generate-synthetic-cohort.mjs --count 6 --seed
 *   node scripts/generate-synthetic-cohort.mjs --seed --enrich --clean-test
 */

import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { generateSyntheticCohort, ITDA_PADERU_VILLAGES, SYNTHETIC_PNG_BASE64 } from '../src/synthetic-data.mjs';
import { openStore, transaction, recordConsent, putEvent, audit, patientFrom } from '../src/store.mjs';
import { loadConfig } from '../src/config.mjs';
import { parseDataUrl, storePatientImage } from '../src/image-storage.mjs';
import { ITDA_FACILITIES, DENTAL_QUADRANTS } from '../src/facilities.mjs';

const args = process.argv.slice(2);
const countIndex = args.indexOf('--count');
const count = countIndex !== -1 && args[countIndex + 1] ? parseInt(args[countIndex + 1], 10) : 5;
const shouldSeed = args.includes('--seed');
const enrichExisting = args.includes('--enrich');
const cleanTestRows = args.includes('--clean-test');

const AI_SCENARIOS = [
  {
    modelClass: 'Suspicious Leukoplakia Plaque',
    findings: [
      { label: 'Leukoplakia', score: 0.78 },
      { label: 'Normal Mucosa', score: 0.14 },
      { label: 'Lichen Planus', score: 0.08 }
    ],
    impression: 'White homogeneous leukoplakia plaque along buccal mucosa; biopsy & cessation counseling advised.'
  },
  {
    modelClass: 'Oral Submucous Fibrosis (OSMF)',
    findings: [
      { label: 'Oral Submucous Fibrosis (OSMF)', score: 0.81 },
      { label: 'Leukoplakia', score: 0.11 },
      { label: 'Normal Mucosa', score: 0.08 }
    ],
    impression: 'Palpable fibrous bands limiting mouth opening (~2.5 fingers); strict areca-nut cessation & specialist consult.'
  },
  {
    modelClass: 'Suspicious Ulcerative Lesion',
    findings: [
      { label: 'Suspicious Ulcerative Lesion', score: 0.74 },
      { label: 'Mouth Ulcer', score: 0.19 },
      { label: 'Normal Mucosa', score: 0.07 }
    ],
    impression: 'Non-healing ulcer (>14 days) along lateral border of tongue; urgent excision/punch biopsy ordered.'
  },
  {
    modelClass: 'Dental Caries & Gingivitis',
    findings: [
      { label: 'Dental Caries', score: 0.72 },
      { label: 'Gingivitis', score: 0.20 },
      { label: 'Normal Mucosa', score: 0.08 }
    ],
    impression: 'Subgingival calculus & carious mandibular molar without mucosal atypia; scaling & restoration planned.'
  },
  {
    modelClass: 'Normal Oral Mucosa',
    findings: [
      { label: 'Normal Mucosa', score: 0.89 },
      { label: 'Gingivitis', score: 0.08 },
      { label: 'Leukoplakia', score: 0.03 }
    ],
    impression: 'Healthy pink oral mucosa with mild dietary staining; preventive education completed.'
  }
];

const STANDARD_WARNINGS = [
  'Research & decision support advisory only. Not a definitive clinical diagnosis.',
  'All candidate findings must be verified by a registered Dental Surgeon (BDS/MDS) or Medical Officer.',
  'Does not confirm or rule out malignant transformation without tissue biopsy.'
];

function isoDaysOffset(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function isoHoursOffset(hours) {
  const d = new Date();
  d.setUTCHours(d.getUTCHours() + hours);
  return d.toISOString();
}

function loadDemoPhotoBuffer(rootDir) {
  const demoJpg = join(rootDir, 'public', 'oral_image_demo.jpg');
  if (existsSync(demoJpg)) {
    return { buffer: readFileSync(demoJpg), mimeHint: 'image/jpeg' };
  }
  return parseDataUrl(SYNTHETIC_PNG_BASE64);
}

function resolveActors(db) {
  const byRole = (role) => db.prepare('SELECT * FROM users WHERE role = ? AND active = 1 ORDER BY id LIMIT 1').get(role);
  return {
    worker: byRole('worker') || byRole('asha'),
    doctor: byRole('doctor'),
    specialist: byRole('specialist') || byRole('doctor'),
    navigator: byRole('navigator') || byRole('hospital') || byRole('worker'),
    admin: byRole('admin')
  };
}

/**
 * Applies multi-stage workflow progression (AI analysis, doctor review, referral,
 * investigation, consultation, navigation, and care history) to a patient record
 * when the downstream tables do not already have workflow records for that patient.
 */
function enrichPatientWorkflow(db, row, idx, actors, storageDir, demoPhoto) {
  const patient = patientFrom(row);
  const pid = patient.id;
  const now = new Date().toISOString();

  // 1. Ensure patient photograph is backed by a real stored image in storage/images/
  if (!patient.imageId || (patient.photo && patient.photo.startsWith('data:image/'))) {
    try {
      const saved = storePatientImage(db, {
        patientId: pid,
        buffer: demoPhoto.buffer,
        mimeHint: demoPhoto.mimeHint,
        uploadedBy: actors.worker.id,
        storageDir
      });
      patient.photo = saved.url;
      patient.imageId = saved.id;
      patient.quality = { pass: true, brightness: 138, contrast: 42, detail: 14, score: 92 };
    } catch {}
  }

  // Ensure active consent record exists
  const hasConsent = db.prepare('SELECT id FROM consents WHERE patient_id = ? LIMIT 1').get(pid);
  if (!hasConsent) {
    recordConsent(db, {
      patientId: pid,
      version: 'v1.0-ITDA',
      language: idx % 2 === 0 ? 'te' : 'en',
      termsText: 'ITDA Paderu Oral Screening & Research Consent (Synthetic Demo)',
      userId: actors.worker.id
    });
  }

  // Spread across all 6 workflow stages deterministically by index
  // 0,1,2 -> referred (some urgent/overdue); 3,4 -> diagnostics; 5,6 -> treatment; 7,8 -> reviewed; 9 -> closed; >=10 -> screened
  const profilePlan = [
    { stage: 'referred', priority: 'emergency', refStatus: 'referred', dueDays: -4, facIdx: 5, aiIdx: 2, quadIdx: 4 },
    { stage: 'referred', priority: 'urgent', refStatus: 'scheduled', dueDays: -2, facIdx: 0, aiIdx: 0, quadIdx: 3 },
    { stage: 'referred', priority: 'routine', refStatus: 'referred', dueDays: 5, facIdx: 1, aiIdx: 1, quadIdx: 2 },
    { stage: 'diagnostics', priority: 'urgent', refStatus: 'attended', dueDays: 3, facIdx: 0, aiIdx: 0, quadIdx: 4 },
    { stage: 'diagnostics', priority: 'routine', refStatus: 'attended', dueDays: 7, facIdx: 1, aiIdx: 1, quadIdx: 1 },
    { stage: 'treatment', priority: 'urgent', refStatus: 'completed', dueDays: 10, facIdx: 5, aiIdx: 2, quadIdx: 3 },
    { stage: 'treatment', priority: 'routine', refStatus: 'completed', dueDays: 12, facIdx: 2, aiIdx: 3, quadIdx: 0 },
    { stage: 'reviewed', priority: 'routine', refStatus: null, dueDays: 14, facIdx: 3, aiIdx: 4, quadIdx: 5 },
    { stage: 'reviewed', priority: 'routine', refStatus: null, dueDays: 21, facIdx: 4, aiIdx: 3, quadIdx: 5 },
    { stage: 'closed', priority: 'routine', refStatus: 'completed', dueDays: '', facIdx: 0, aiIdx: 4, quadIdx: 0 }
  ];

  const plan = profilePlan[idx % (profilePlan.length + 3)]; // Remaining stay in 'screened' queue
  const aiScenario = AI_SCENARIOS[(idx + 1) % AI_SCENARIOS.length];

  // 2. Seed Gemini Vision AI analysis on screened & progressed patients (~75% coverage)
  const hasAi = db.prepare('SELECT id FROM ai_analyses WHERE patient_id = ? LIMIT 1').get(pid);
  if (!hasAi && (plan || idx % 2 === 0)) {
    const scenario = plan ? AI_SCENARIOS[plan.aiIdx] : aiScenario;
    const analysisId = randomUUID();
    const processedAt = isoHoursOffset(-24 - idx * 3);
    db.prepare(`
      INSERT INTO ai_analyses(id, patient_id, image_id, model_name, model_version, model_class, candidate_findings, warnings, status, requested_by, processed_at)
      VALUES(?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?)
    `).run(
      analysisId,
      pid,
      patient.imageId || null,
      'Google Gemini 1.5 Flash (Vision)',
      'v1.5-vision',
      scenario.modelClass,
      JSON.stringify(scenario.findings),
      JSON.stringify(STANDARD_WARNINGS),
      actors.doctor.id,
      processedAt
    );

    patient.researchAI = {
      model: 'Google Gemini 1.5 Flash (Vision)',
      revision: 'v1.5-vision',
      modelClass: scenario.modelClass,
      candidateFindings: scenario.findings,
      warnings: STANDARD_WARNINGS,
      researchOnly: true,
      clinicallyValidated: false,
      at: processedAt,
      requestedBy: actors.doctor.id
    };
    audit(db, actors.doctor, 'research_ai.completed', pid, { modelClass: scenario.modelClass, analysisId });
  }

  // If patient remains in 'screened' queue, persist updated photo/AI metadata cleanly
  if (!plan) {
    delete patient.version;
    delete patient.createdBy;
    delete patient.updatedAt;
    db.prepare('UPDATE patients SET body = ?, version = version + 1, updated_at = ? WHERE id = ?').run(
      JSON.stringify(patient),
      now,
      pid
    );
    return;
  }

  const facility = ITDA_FACILITIES[plan.facIdx % ITDA_FACILITIES.length].name;
  const quadrant = DENTAL_QUADRANTS[plan.quadIdx % DENTAL_QUADRANTS.length].code;
  const dueDate = typeof plan.dueDays === 'number' ? isoDaysOffset(plan.dueDays) : '';
  const scenario = AI_SCENARIOS[plan.aiIdx];

  // Avoid overwriting records that already underwent manual clinician reviews
  const hasReview = db.prepare('SELECT id FROM clinical_reviews WHERE patient_id = ? LIMIT 1').get(pid);
  if (!hasReview && patient.stage === 'screened') {
    patient.stage = plan.stage;
    patient.facility = facility;
    patient.due = dueDate;
    patient.quadrant = quadrant;
    patient.provisionalDiagnosis = scenario.modelClass;
    patient.priority = plan.priority;
    patient.notes = scenario.impression;
    patient.timeline = [
      ...(patient.timeline || []),
      {
        at: isoHoursOffset(-18 - idx),
        text: `Reviewed by ${actors.doctor.name}: ${plan.stage} at ${facility} [${quadrant}].`,
        te: `${actors.doctor.name} సమీక్ష: ${facility} కు ${plan.stage} [${quadrant}].`
      }
    ];

    db.prepare(`
      INSERT INTO clinical_reviews(id, patient_id, reviewer_id, stage, quadrant, provisional_diagnosis, clinical_notes, facility, due_date, created_at)
      VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(randomUUID(), pid, actors.doctor.id, plan.stage, quadrant, scenario.modelClass, scenario.impression, facility, dueDate, isoHoursOffset(-18 - idx));
    audit(db, actors.doctor, 'review.completed', pid, { stage: plan.stage, facility, quadrant });
  }

  // 3. Seed Facility Referrals
  const hasRef = db.prepare('SELECT id FROM referrals WHERE patient_id = ? LIMIT 1').get(pid);
  let refId = hasRef?.id || null;
  if (!hasRef && plan.refStatus) {
    refId = randomUUID();
    db.prepare(`
      INSERT INTO referrals(id, patient_id, facility, priority, due_date, notes, status, created_by, created_at, updated_at, quadrant)
      VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      refId,
      pid,
      facility,
      plan.priority,
      dueDate || isoDaysOffset(3),
      scenario.impression,
      plan.refStatus,
      actors.doctor.id,
      isoHoursOffset(-16 - idx),
      isoHoursOffset(-8),
      quadrant
    );
    audit(db, actors.doctor, 'referral.created', pid, { referralId: refId, facility, priority: plan.priority });
  }

  // 4. Seed Investigations (Biopsy / Histopathology / Cytology / OPG)
  const hasInv = db.prepare('SELECT id FROM investigations WHERE patient_id = ? LIMIT 1').get(pid);
  if (!hasInv && ['diagnostics', 'treatment', 'closed', 'referred'].includes(plan.stage)) {
    const testTypes = ['biopsy', 'histopathology', 'cytology', 'radiology_opg'];
    const tType = testTypes[idx % testTypes.length];
    const invStatus = plan.stage === 'treatment' || plan.stage === 'closed' ? 'completed' : idx % 2 === 0 ? 'processing' : 'ordered';
    const findings =
      invStatus === 'completed'
        ? 'Histopathology report: Hyperkeratosis with mild epithelial dysplasia; margins negative for invasive carcinoma.'
        : `Ordered ${tType} specimen collection at ${facility} for quadrant ${quadrant}.`;

    db.prepare(`
      INSERT INTO investigations(id, patient_id, referral_id, test_type, facility, ordered_by, status, clinical_findings, ordered_at, reported_at)
      VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      randomUUID(),
      pid,
      refId,
      tType,
      facility,
      actors.specialist.id,
      invStatus,
      findings,
      isoHoursOffset(-14 - idx),
      invStatus === 'completed' ? isoHoursOffset(-3) : null
    );
    audit(db, actors.specialist, 'investigation.ordered', pid, { testType: tType, status: invStatus, facility });
  }

  // 5. Seed WebRTC Teleconsultations
  const hasConsult = db.prepare('SELECT id FROM consultations WHERE patient_id = ? LIMIT 1').get(pid);
  if (!hasConsult && ['referred', 'diagnostics', 'treatment'].includes(plan.stage)) {
    const cId = randomUUID();
    const evId = randomUUID();
    const cStatus = plan.stage === 'treatment' ? 'completed' : plan.stage === 'diagnostics' ? 'ready' : 'preparing';
    const scheduledAt = cStatus === 'completed' ? isoHoursOffset(-20) : isoHoursOffset(6 + idx * 2);
    const roomUrl = cStatus === 'preparing' ? null : `https://meet.jit.si/Drishti-${cId}`;
    const evBody = JSON.stringify({
      id: evId,
      type: 'consultation.requested',
      patientId: pid,
      createdAt: now,
      data: { consultationId: cId, scheduledAt }
    });
    db.prepare('INSERT INTO events(id, patient_id, type, body) VALUES(?, ?, ?, ?)').run(evId, pid, 'consultation.requested', evBody);
    db.prepare(`
      INSERT INTO consultations(id, patient_id, scheduled_at, status, room_url, created_by, event_id, created_at)
      VALUES(?, ?, ?, ?, ?, ?, ?, ?)
    `).run(cId, pid, scheduledAt, cStatus, roomUrl, actors.doctor.id, evId, isoHoursOffset(-12));
    audit(db, actors.doctor, 'consultation.requested', pid, { consultationId: cId, status: cStatus });
  }

  // 6. Seed Patient Navigation & Transport Support
  const hasNav = db.prepare('SELECT id FROM patient_navigation WHERE patient_id = ? LIMIT 1').get(pid);
  if (!hasNav && actors.navigator && ['referred', 'diagnostics', 'treatment'].includes(plan.stage)) {
    const barriers = [
      'ITDA Tribal Bus Voucher Provided',
      '104 Mobile Feeder Vehicle Assigned',
      'ASHA Escort Scheduled from Hamlet'
    ];
    const contactStatus = plan.stage === 'treatment' || plan.stage === 'diagnostics' ? 'contacted' : 'visit_scheduled';
    const attended = plan.stage === 'treatment' || plan.stage === 'diagnostics' ? 1 : 0;
    db.prepare(`
      INSERT INTO patient_navigation(id, patient_id, referral_id, navigator_id, contact_status, barrier_identified, attendance_confirmed, notes, followup_due, updated_at)
      VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      randomUUID(),
      pid,
      refId,
      actors.navigator.id,
      contactStatus,
      barriers[idx % barriers.length],
      attended,
      `Coordinated tribal transport & appointment confirmation at ${facility}.`,
      dueDate || isoDaysOffset(2),
      now
    );
    audit(db, actors.navigator, 'navigation.recorded', pid, { contactStatus, attended });
  }

  // 7. Seed Longitudinal Care Records
  const hasCare = db.prepare('SELECT id FROM care_records WHERE patient_id = ? LIMIT 1').get(pid);
  if (!hasCare && ['treatment', 'closed'].includes(plan.stage)) {
    const careEntry = {
      id: randomUUID(),
      type: plan.stage === 'closed' ? 'followup' : 'treatment',
      status: plan.stage === 'closed' ? 'completed' : 'planned',
      title: plan.stage === 'closed' ? 'Post-Counseling Oral Mucosa Check' : 'Antioxidant & Topical Steroid Protocol',
      facility,
      date: isoDaysOffset(plan.stage === 'closed' ? -3 : 7),
      notes: scenario.impression,
      author: actors.specialist.name,
      at: now
    };
    db.prepare(`
      INSERT INTO care_records(id, patient_id, type, title, facility, date, status, notes, report_url, author_id, created_at)
      VALUES(?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)
    `).run(careEntry.id, pid, careEntry.type, careEntry.title, facility, careEntry.date, careEntry.status, careEntry.notes, actors.specialist.id, now);
    patient.careEntries = [...(patient.careEntries || []), careEntry];
    audit(db, actors.specialist, `care.${careEntry.type}`, pid);
  }

  delete patient.version;
  delete patient.createdBy;
  delete patient.updatedAt;
  db.prepare('UPDATE patients SET body = ?, version = version + 1, updated_at = ? WHERE id = ?').run(
    JSON.stringify(patient),
    now,
    pid
  );
}

console.log(`Generating ${count} synthetic patient records for ITDA Paderu...`);
const cohort = generateSyntheticCohort(count);

if (shouldSeed) {
  const config = loadConfig();
  const db = openStore(config.paths.dataDir);
  const actors = resolveActors(db);

  if (!actors.worker || !actors.doctor) {
    console.error('Error: Required demo user accounts not found in database. Start the server once first.');
    process.exit(1);
  }

  if (cleanTestRows) {
    transaction(db, () => {
      const testIds = db.prepare("SELECT id FROM patients WHERE id LIKE 'AD-TEST-%'").all().map((r) => r.id);
      for (const id of testIds) {
        for (const table of ['ai_analyses', 'clinical_reviews', 'investigations', 'patient_navigation', 'care_records', 'consultations', 'referrals', 'consents', 'images', 'events']) {
          db.prepare(`DELETE FROM ${table} WHERE patient_id = ?`).run(id);
        }
        db.prepare('DELETE FROM patients WHERE id = ?').run(id);
      }
      if (testIds.length) {
        console.log(`Removed ${testIds.length} transient AD-TEST-* smoke-test records.`);
      }
    });
  }

  const demoPhoto = loadDemoPhotoBuffer(process.cwd());
  let seededCount = 0;

  for (let i = 0; i < cohort.length; i++) {
    const patient = cohort[i];
    // Guarantee broad coverage across ITDA Paderu Agency Mandals
    patient.village = ITDA_PADERU_VILLAGES[i % ITDA_PADERU_VILLAGES.length];
    const existing = db.prepare('SELECT id FROM patients WHERE id = ?').get(patient.id);
    if (existing) continue;

    transaction(db, () => {
      db.prepare('INSERT INTO patients VALUES(?, ?, ?, ?, ?)').run(
        patient.id,
        JSON.stringify(patient),
        1,
        actors.worker.id,
        patient.createdAt
      );

      const savedImage = storePatientImage(db, {
        patientId: patient.id,
        buffer: demoPhoto.buffer,
        mimeHint: demoPhoto.mimeHint,
        uploadedBy: actors.worker.id,
        storageDir: config.paths.storageDir
      });
      patient.photo = savedImage.url;
      patient.imageId = savedImage.id;
      patient.quality = { pass: true, brightness: 138, contrast: 42, detail: 14, score: 92 };
      db.prepare('UPDATE patients SET body = ? WHERE id = ?').run(JSON.stringify(patient), patient.id);

      recordConsent(db, {
        patientId: patient.id,
        version: patient.consentVersion,
        language: patient.consentLanguage,
        termsText: patient.consentText,
        userId: actors.worker.id
      });

      putEvent(db, 'screening.created', patient);
      audit(db, actors.worker, 'synthetic.seeded', patient.id);
      seededCount++;
    });
  }

  if (enrichExisting || seededCount > 0) {
    const allRows = db.prepare('SELECT * FROM patients ORDER BY updated_at ASC').all();
    transaction(db, () => {
      allRows.forEach((row, idx) => {
        enrichPatientWorkflow(db, row, idx, actors, config.paths.storageDir, demoPhoto);
      });
    });
    console.log(`Enriched clinical workflow progression across ${allRows.length} synthetic patient records.`);
  }

  console.log(`Successfully seeded ${seededCount} synthetic patients into ${config.paths.dataDir}/drishti.sqlite`);
  db.close();
} else {
  console.log(JSON.stringify(cohort, null, 2));
}
