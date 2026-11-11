import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  ITDA_FACILITIES,
  DENTAL_QUADRANTS,
  REFERRAL_PRIORITIES,
  REFERRAL_STATUSES,
  isValidReferralTransition,
  isReferralOverdue,
} from '../src/facilities.mjs';
import { startServer } from '../src/server.mjs';

test('Facilities & Dental Quadrants: catalog integrity and referral state machine logic', () => {
  // 1. Verify ITDA Facilities Directory
  assert.equal(ITDA_FACILITIES.length, 6);
  assert.ok(ITDA_FACILITIES.some((f) => f.id === 'AH_PADERU' && f.hasDentalSurgeon));
  assert.ok(ITDA_FACILITIES.some((f) => f.id === 'CHC_ARAKU'));
  assert.ok(ITDA_FACILITIES.some((f) => f.id === 'KGH_VIZAG' && f.hasBiopsyFacility));

  // 2. Verify Dental Quadrants
  assert.equal(DENTAL_QUADRANTS.length, 6);
  const q1 = DENTAL_QUADRANTS.find((q) => q.code === 'Q1_UR');
  assert.ok(q1 && q1.teethRange === '11-18');
  assert.ok(DENTAL_QUADRANTS.some((q) => q.code === 'MUCOSA'));

  // 3. Referral State Machine transitions
  assert.equal(isValidReferralTransition('referred', 'scheduled'), true);
  assert.equal(isValidReferralTransition('scheduled', 'attended'), true);
  assert.equal(isValidReferralTransition('attended', 'completed'), true);
  assert.equal(isValidReferralTransition('referred', 'attended'), true);
  assert.equal(isValidReferralTransition('scheduled', 'cancelled'), true);
  assert.equal(isValidReferralTransition('referred', 'completed'), false); // Cannot complete without being attended
  assert.equal(isValidReferralTransition('completed', 'scheduled'), false); // Terminal state

  // 4. Overdue logic
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  assert.equal(isReferralOverdue(yesterday, 'referred'), true);
  assert.equal(isReferralOverdue(yesterday, 'scheduled'), true);
  assert.equal(isReferralOverdue(tomorrow, 'referred'), false);
  assert.equal(isReferralOverdue(yesterday, 'completed'), false); // Completed referrals are not overdue
  assert.equal(isReferralOverdue(yesterday, 'cancelled'), false);
});

test('Clinical Review & Referral State Machine: quadrants, priority triage, and care queue', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'drishti-workflow-test-'));

  const server = await startServer({
    port: 0,
    dataDir: directory,
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const accounts = JSON.parse(await readFile(join(directory, 'demo-accounts.json'), 'utf8')).accounts;

  const request = async (path, method = 'GET', data, auth, extra = {}) => {
    const r = await fetch(base + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(auth ? { Cookie: auth.cookie, 'X-CSRF-Token': auth.csrf } : {}),
        ...extra,
      },
      ...(data ? { body: JSON.stringify(data) } : {}),
    });
    return { status: r.status, body: await r.json(), cookie: r.headers.get('set-cookie') };
  };

  try {
    const signIn = async (role) => {
      const a = accounts.find((acc) => acc.role === role);
      const r = await request('/api/auth/login', 'POST', { email: a.email, password: a.password });
      assert.equal(r.status, 200);
      return { ...r.body, cookie: r.cookie.split(';')[0] };
    };

    const worker = await signIn('worker');
    const doctor = await signIn('doctor');

    // 1. GET /api/facilities
    const facRes = await request('/api/facilities', 'GET', null, worker);
    assert.equal(facRes.status, 200);
    assert.equal(facRes.body.facilities.length, 6);
    assert.equal(facRes.body.quadrants.length, 6);

    // 2. Register patient
    const patientData = {
      id: 'AD-CLINICAL-001',
      name: 'Somulu Gollori',
      age: 48,
      village: 'Hukumpeta',
      history: 'Non-healing ulcer on right buccal mucosa, tobacco chewer for 20 years',
      consent: true,
      consentVersion: 'v1.0-ITDA',
      consentLanguage: 'te',
    };
    const regRes = await request('/api/patients', 'POST', patientData, worker);
    assert.equal(regRes.status, 201);
    let patient = regRes.body.patient;

    // 3. Clinical Review with Quadrant & Referral creation
    // Worker cannot review
    const workerReview = await request(
      `/api/patients/${patient.id}/review`,
      'POST',
      { version: patient.version, stage: 'reviewed', notes: 'Unauthorized worker review' },
      worker
    );
    assert.equal(workerReview.status, 403);

    // Doctor reviews with quadrant and refers
    const reviewData = {
      version: patient.version,
      stage: 'referred',
      quadrant: 'MUCOSA',
      provisionalDiagnosis: 'Suspected Oral Submucous Fibrosis with Leukoplakia',
      facility: 'Area Hospital Paderu',
      priority: 'urgent',
      due: '2026-11-10',
      notes: 'Urgent biopsy and surgical evaluation indicated.',
    };

    const docReview = await request(
      `/api/patients/${patient.id}/review`,
      'POST',
      reviewData,
      doctor
    );
    assert.equal(docReview.status, 200);
    patient = docReview.body.patient;
    assert.equal(patient.stage, 'referred');
    assert.equal(patient.quadrant, 'MUCOSA');
    assert.equal(patient.provisionalDiagnosis, 'Suspected Oral Submucous Fibrosis with Leukoplakia');

    // 4. Verify historical relational ledger: GET /api/patients/:id/clinical-reviews
    const reviewLedger = await request(
      `/api/patients/${patient.id}/clinical-reviews`,
      'GET',
      null,
      doctor
    );
    assert.equal(reviewLedger.status, 200);
    assert.equal(reviewLedger.body.reviews.length, 1);
    assert.equal(reviewLedger.body.reviews[0].quadrant, 'MUCOSA');
    assert.equal(reviewLedger.body.reviews[0].stage, 'referred');

    // 5. Verify patient's referrals: GET /api/patients/:id/referrals
    const patRefs = await request(`/api/patients/${patient.id}/referrals`, 'GET', null, worker);
    assert.equal(patRefs.status, 200);
    assert.equal(patRefs.body.referrals.length, 1);
    const referral = patRefs.body.referrals[0];
    assert.equal(referral.patient_id, patient.id);
    assert.equal(referral.facility, 'Area Hospital Paderu');
    assert.equal(referral.priority, 'urgent');
    assert.equal(referral.status, 'referred');

    // 6. Referral Task Queue: GET /api/referrals
    const queueRes = await request('/api/referrals', 'GET', null, worker);
    assert.equal(queueRes.status, 200);
    assert.ok(queueRes.body.referrals.length >= 1);
    const queueItem = queueRes.body.referrals.find((r) => r.id === referral.id);
    assert.ok(queueItem);
    assert.equal(queueItem.patient.name, 'Somulu Gollori');
    assert.equal(queueItem.patient.village, 'Hukumpeta');

    // Filter by priority
    const urgentQueue = await request('/api/referrals?priority=urgent', 'GET', null, worker);
    assert.equal(urgentQueue.status, 200);
    assert.ok(urgentQueue.body.referrals.some((r) => r.id === referral.id));

    const emergencyQueue = await request('/api/referrals?priority=emergency', 'GET', null, worker);
    assert.equal(emergencyQueue.status, 200);
    assert.ok(!emergencyQueue.body.referrals.some((r) => r.id === referral.id));

    // 7. Referral State Machine Transition: PATCH /api/referrals/:id
    // Illegal transition: referred -> completed (must be attended first)
    const illegalPatch = await request(
      `/api/referrals/${referral.id}`,
      'PATCH',
      { status: 'completed' },
      worker
    );
    assert.equal(illegalPatch.status, 400);

    // Valid transition 1: referred -> scheduled
    const schedPatch = await request(
      `/api/referrals/${referral.id}`,
      'PATCH',
      { status: 'scheduled', notes: 'Van transport arranged for appointment' },
      worker
    );
    assert.equal(schedPatch.status, 200);
    assert.equal(schedPatch.body.referral.status, 'scheduled');

    // Valid transition 2: scheduled -> attended
    const attendPatch = await request(
      `/api/referrals/${referral.id}`,
      'PATCH',
      { status: 'attended', notes: 'Patient arrived at AH Paderu, preliminary biopsy taken' },
      doctor
    );
    assert.equal(attendPatch.status, 200);
    assert.equal(attendPatch.body.referral.status, 'attended');

    // Valid transition 3: attended -> completed
    const completePatch = await request(
      `/api/referrals/${referral.id}`,
      'PATCH',
      { status: 'completed', notes: 'Histopathology received, care regimen initiated' },
      doctor
    );
    assert.equal(completePatch.status, 200);
    assert.equal(completePatch.body.referral.status, 'completed');
    assert.equal(completePatch.body.patient.stage, 'treatment');

    // 8. Explicit Referral Endpoint: POST /api/patients/:id/referrals
    const explicitRefRes = await request(
      `/api/patients/${patient.id}/referrals`,
      'POST',
      {
        facility: 'King George Hospital Visakhapatnam (Tertiary)',
        priority: 'emergency',
        dueDate: '2026-11-01',
        quadrant: 'Q4_LR',
        notes: 'Tertiary oncological consultation required.',
      },
      doctor
    );
    assert.equal(explicitRefRes.status, 201);
    assert.equal(explicitRefRes.body.referral.facility, 'King George Hospital Visakhapatnam (Tertiary)');
    assert.equal(explicitRefRes.body.referral.priority, 'emergency');
    assert.equal(explicitRefRes.body.referral.quadrant, 'Q4_LR');
  } finally {
    server.close();
  }
});
