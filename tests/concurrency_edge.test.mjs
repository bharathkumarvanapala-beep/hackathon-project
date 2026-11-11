import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer } from '../src/server.mjs';

test('Concurrency & Race Conditions: optimistic locking, concurrent reviews, and WAL non-blocking reads', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'drishti-concurrency-'));
  const server = await startServer({ port: 0, dataDir: directory });
  const base = `http://127.0.0.1:${server.address().port}`;

  const accounts = JSON.parse(
    await readFile(join(directory, 'demo-accounts.json'), 'utf8')
  ).accounts;

  const request = async (path, method = 'GET', data, auth, extra = {}) => {
    const r = await fetch(base + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(auth ? { Cookie: auth.cookie, 'X-CSRF-Token': auth.csrf } : {}),
        ...extra
      },
      ...(data ? { body: JSON.stringify(data) } : {})
    });
    const text = await r.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
    return { status: r.status, body, cookie: r.headers.get('set-cookie') };
  };

  const signIn = async (role) => {
    const a = accounts.find((acc) => acc.role === role);
    const r = await request('/api/auth/login', 'POST', {
      email: a.email,
      password: a.password
    });
    assert.equal(r.status, 200);
    return { ...r.body, cookie: r.cookie.split(';')[0] };
  };

  try {
    const worker = await signIn('worker');
    const doctor = await signIn('doctor');

    // 1. Create a baseline patient
    const patientId = 'AD-CONCUR-001';
    const initialPatient = {
      id: patientId,
      name: 'Ramu Somulu',
      age: 48,
      village: 'Araku Valley',
      history: 'Leukoplakia suspected, chronic betel nut chewing.',
      consent: true
    };

    const createRes = await request('/api/patients', 'POST', initialPatient, worker);
    assert.equal(createRes.status, 201);
    assert.equal(createRes.body.patient.version, 1);

    // 2. High-concurrency race condition: 10 simultaneous clinical review requests
    // All 10 requests specify version 1. Exactly 1 must succeed with 200, and 9 must receive 409 Conflict.
    const concurrentReviewPayloads = Array.from({ length: 10 }, (_, i) => ({
      stage: 'referred',
      notes: `Concurrent Clinical Review Submission #${i + 1}`,
      facility: 'Area Hospital Paderu',
      due: '2026-11-15',
      version: 1, // Stale version for 9 of the 10
      quadrant: 'MUCOSA',
      provisionalDiagnosis: `Suspicious leukoplakia #${i + 1}`,
      priority: 'urgent'
    }));

    const reviewResponses = await Promise.all(
      concurrentReviewPayloads.map((payload) =>
        request(`/api/patients/${patientId}/review`, 'PATCH', payload, doctor)
      )
    );

    const successCount = reviewResponses.filter((r) => r.status === 200).length;
    const conflictCount = reviewResponses.filter((r) => r.status === 409).length;

    assert.equal(
      successCount,
      1,
      `Expected exactly 1 successful review under race condition, got ${successCount}`
    );
    assert.equal(
      conflictCount,
      9,
      `Expected exactly 9 409 conflicts under race condition, got ${conflictCount}`
    );

    // Verify patient version in database incremented exactly once to 2
    const patientAfterRace = await request('/api/patients', 'GET', undefined, doctor);
    const pRecord = patientAfterRace.body.patients.find((p) => p.id === patientId);
    assert.equal(pRecord.version, 2, 'Version must be incremented exactly once to 2');

    // Verify clinical reviews ledger has exactly 1 review
    const reviewsRes = await request(
      `/api/patients/${patientId}/clinical-reviews`,
      'GET',
      undefined,
      doctor
    );
    assert.equal(reviewsRes.status, 200);
    assert.equal(reviewsRes.body.reviews.length, 1);

    // 3. Concurrent screening creation: 5 distinct workers submitting distinct records concurrently
    const distinctScreenings = Array.from({ length: 5 }, (_, i) => ({
      id: `AD-CONCUR-BATCH-${i + 1}`,
      name: `Batch Patient ${i + 1}`,
      age: 30 + i,
      village: 'Hukumpeta',
      history: 'Regular screening',
      consent: true
    }));

    const batchCreateResponses = await Promise.all(
      distinctScreenings.map((p) => request('/api/patients', 'POST', p, worker))
    );

    for (const r of batchCreateResponses) {
      assert.equal(r.status, 201, 'Concurrent writes with distinct IDs must all succeed');
    }

    // 4. Non-blocking reads during active writes (SQLite WAL mode test)
    // Fire a burst of concurrent reads while performing an update
    const readPromises = Array.from({ length: 15 }, () =>
      request('/api/patients', 'GET', undefined, doctor)
    );
    const writePromise = request(
      `/api/patients/${patientId}/review`,
      'PATCH',
      {
        stage: 'diagnostics',
        notes: 'Follow-up diagnostics scheduled',
        facility: 'Community Health Centre Araku',
        due: '2026-11-20',
        version: 2, // Current valid version
        quadrant: 'MUCOSA'
      },
      doctor
    );

    const [writeRes, ...readResults] = await Promise.all([writePromise, ...readPromises]);
    assert.equal(writeRes.status, 200);
    for (const readRes of readResults) {
      assert.equal(readRes.status, 200, 'Reads must never be blocked by active writes in WAL mode');
    }

    // 5. Concurrent referral state transitions:
    // Create a referral first
    const refCreate = await request(
      `/api/patients/${patientId}/referrals`,
      'POST',
      {
        facility: 'Area Hospital Paderu',
        priority: 'urgent',
        due_date: '2026-11-18',
        notes: 'Biopsy referral'
      },
      doctor
    );
    assert.equal(refCreate.status, 201);
    const referralId = refCreate.body.referral.id;

    // Simultaneous transition attempts from 'referred':
    // Attempt 1: transition to 'scheduled' (legal)
    // Attempt 2: transition directly to 'completed' (illegal - cannot jump from referred to completed)
    const [t1, t2] = await Promise.all([
      request(`/api/referrals/${referralId}`, 'PATCH', { status: 'scheduled' }, doctor),
      request(`/api/referrals/${referralId}`, 'PATCH', { status: 'completed' }, doctor)
    ]);

    assert.equal(t1.status, 200, 'Legal transition to scheduled must succeed');
    assert.equal(t2.status, 400, 'Illegal jump to completed must fail with 400');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
