import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer } from '../src/server.mjs';
import { computeLiveStats } from '../public/district-dashboard.js';

test('District Dashboard API & Helper: 100% live SQLite aggregation with zero hardcoded counts', async () => {
  // 1. Verify frontend fallback helper never injects hardcoded numbers
  const emptySnapshot = computeLiveStats({});
  assert.equal(emptySnapshot.totalPatients, 0);
  assert.equal(emptySnapshot.totalConsultations, 0);
  assert.equal(emptySnapshot.suspiciousFindings, 0);
  assert.deepEqual(emptySnapshot.villageBreakdown, []);

  // 2. Spin up isolated backend against fresh empty DB
  const dir = await mkdtemp(join(tmpdir(), 'drishti-district-test-'));
  const server = await startServer({
    port: 0,
    dataDir: dir,
    storageDir: join(dir, 'storage'),
    rateLimitMax: 1000
  });

  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const loginAs = async (email) => {
      const res = await fetch(`${base}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'Drishti@2026' })
      });
      assert.equal(res.status, 200);
      const data = await res.json();
      return { cookie: res.headers.get('set-cookie').split(';')[0], csrf: data.csrf };
    };

    const admin = await loginAs('admin@drishti.demo');
    const worker = await loginAs('asha@drishti.demo');
    const doctor = await loginAs('doctor@drishti.demo');
    const patientSession = await loginAs('patient@drishti.demo');

    // Fresh DB must report zero for patient/case metrics (nothing hardcoded)
    const initialStatsRes = await fetch(`${base}/api/dashboard/stats`, {
      headers: { Cookie: admin.cookie }
    });
    assert.equal(initialStatsRes.status, 200);
    const { stats: initialStats } = await initialStatsRes.json();
    assert.equal(initialStats.totalPatients, 0);
    assert.equal(initialStats.totalReferrals, 0);
    assert.equal(initialStats.totalConsultations, 0);
    assert.equal(initialStats.aiSummary.totalAnalyses, 0);
    assert.deepEqual(initialStats.villageBreakdown, []);
    assert.ok(initialStats.teamSummary.staffCount >= 5);

    // 3. Create patient with valid synthetic JPEG fixture and run live workflow
    const validJpeg = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
      0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
      0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
      0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x10, 0x00, 0x10, 0x01, 0x01, 0x11,
      0x00, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0xbf,
      0x00, 0xff, 0xd9
    ]);
    const photoDataUrl = 'data:image/jpeg;base64,' + validJpeg.toString('base64');

    const pId = 'AD-LIVE-CHECK-1';
    const createRes = await fetch(`${base}/api/patients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: worker.cookie, 'X-CSRF-Token': worker.csrf },
      body: JSON.stringify({
        id: pId,
        name: 'Korra Devamma',
        age: 52,
        village: 'G.Madugula',
        phone: '9848011223',
        consent: true,
        history: 'Persistent white patch in left cheek for 3 weeks.',
        photo: photoDataUrl
      })
    });
    assert.equal(createRes.status, 201);
    const { patient } = await createRes.json();

    // Run AI research inference
    const aiRes = await fetch(`${base}/api/patients/${pId}/research-ai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: doctor.cookie, 'X-CSRF-Token': doctor.csrf },
      body: JSON.stringify({ researchAcknowledged: true, version: patient.version })
    });
    assert.equal(aiRes.status, 200);
    const { patient: afterAiPatient } = await aiRes.json();

    // Doctor creates an overdue referral
    const revRes = await fetch(`${base}/api/patients/${pId}/review`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: doctor.cookie, 'X-CSRF-Token': doctor.csrf },
      body: JSON.stringify({
        version: afterAiPatient.version,
        stage: 'referred',
        quadrant: 'MUCOSA',
        provisionalDiagnosis: 'Suspicious leukoplakic plaque',
        notes: 'Urgent specialist biopsy evaluation requested.',
        facility: 'Area Hospital Paderu',
        priority: 'urgent',
        due: '2025-01-15'
      })
    });
    assert.equal(revRes.status, 200);

    // Doctor schedules a teleconsultation
    const consRes = await fetch(`${base}/api/consultations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: doctor.cookie, 'X-CSRF-Token': doctor.csrf },
      body: JSON.stringify({ patientId: pId, scheduledAt: new Date(Date.now() + 3600000).toISOString() })
    });
    assert.equal(consRes.status, 201);

    // Verify GET /api/ai/analyses & GET /api/consultations district-wide endpoints
    const aiListRes = await fetch(`${base}/api/ai/analyses`, { headers: { Cookie: admin.cookie } });
    assert.equal(aiListRes.status, 200);
    const aiListJson = await aiListRes.json();
    assert.equal(aiListJson.analyses.length, 1);
    assert.equal(aiListJson.analyses[0].patientName, 'Korra Devamma');

    const allConsRes = await fetch(`${base}/api/consultations`, { headers: { Cookie: admin.cookie } });
    assert.equal(allConsRes.status, 200);
    const allConsJson = await allConsRes.json();
    assert.equal(allConsJson.consultations.length, 1);
    assert.equal(allConsJson.consultations[0].patientName, 'Korra Devamma');

    // Patient role cannot enumerate all district consultations
    const forbiddenConsRes = await fetch(`${base}/api/consultations`, { headers: { Cookie: patientSession.cookie } });
    assert.equal(forbiddenConsRes.status, 403);

    // Verify updated /api/dashboard/stats mirrors exact SQLite rows
    const liveStatsRes = await fetch(`${base}/api/dashboard/stats`, { headers: { Cookie: admin.cookie } });
    assert.equal(liveStatsRes.status, 200);
    const { stats: live } = await liveStatsRes.json();

    assert.equal(live.totalPatients, 1);
    assert.equal(live.totalScreenings, 1);
    assert.equal(live.pendingReviews, 0);
    assert.equal(live.completedReviews, 1);
    assert.equal(live.activeReferralsCount, 1);
    assert.equal(live.overdueFollowUpsCount, 1);
    assert.equal(live.aiSummary.totalAnalyses, 1);
    assert.equal(live.totalConsultations, 1);
    assert.equal(live.consentsSummary.granted, 1);
    assert.equal(live.villageBreakdown[0].village, 'G.Madugula');
    const paderuFac = live.facilityNetwork.find((f) => f.id === 'AH_PADERU');
    assert.equal(paderuFac.activeReferrals, 1);
    assert.equal(paderuFac.overdueReferrals, 1);
    assert.ok(live.recentAudit.length >= 1);
  } finally {
    server.close();
    await rm(dir, { recursive: true, force: true });
  }
});

