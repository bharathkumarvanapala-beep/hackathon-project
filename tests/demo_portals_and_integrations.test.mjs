import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer } from '../src/server.mjs';

test('New Portal Integrations: Demo Accounts, Investigations, Navigation, WebRTC, and Stats', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'drishti-portals-test-'));
  const server = await startServer({
    port: 0,
    dataDir: dir,
    storageDir: join(dir, 'storage'),
    rateLimitMax: 1000
  });

  try {
    const port = server.address().port;
    const base = `http://127.0.0.1:${port}`;

    // Helper for authenticated requests with session cookies
    async function loginAs(email, password) {
      const res = await fetch(`${base}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      assert.equal(res.status, 200, `Login failed for ${email}`);
      const cookie = res.headers.get('set-cookie');
      const body = await res.json();
      return { cookie, csrf: body.csrf, user: body.user };
    }

    // 1. Verify all 6 synthetic demo accounts from screenshot 2
    const demoAccounts = [
      { role: 'worker', email: 'asha@drishti.demo' },
      { role: 'doctor', email: 'doctor@drishti.demo' },
      { role: 'specialist', email: 'specialist@drishti.demo' },
      { role: 'hospital', email: 'hospital@drishti.demo' },
      { role: 'admin', email: 'admin@drishti.demo' },
      { role: 'patient', email: 'patient@drishti.demo' }
    ];

    for (const demo of demoAccounts) {
      const { user } = await loginAs(demo.email, 'Drishti@2026');
      assert.ok(user, `User should exist for ${demo.email}`);
      assert.equal(user.email, demo.email);
    }

    // 2. Health worker creates a patient screening
    const asha = await loginAs('asha@drishti.demo', 'Drishti@2026');
    const pId = 'AD-TEST-' + Date.now();
    const createRes = await fetch(`${base}/api/patients`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': asha.cookie,
        'X-CSRF-Token': asha.csrf
      },
      body: JSON.stringify({
        id: pId,
        name: 'Raju Demo Patient',
        age: 48,
        village: 'Paderu',
        phone: '9876543210',
        consent: true,
        history: 'Chronic tobacco use with white lesion on right buccal mucosa.'
      })
    });
    assert.equal(createRes.status, 201);
    const { patient } = await createRes.json();
    assert.equal(patient.id, pId);

    // 3. Specialist orders an investigation (Biopsy)
    const specialist = await loginAs('specialist@drishti.demo', 'Drishti@2026');
    const invRes = await fetch(`${base}/api/investigations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': specialist.cookie,
        'X-CSRF-Token': specialist.csrf
      },
      body: JSON.stringify({
        patientId: pId,
        type: 'biopsy',
        facility: 'Area Hospital Paderu',
        notes: 'Punch biopsy of suspicious lesion at Q4_LR.'
      })
    });
    assert.equal(invRes.status, 201);
    const { investigation } = await invRes.json();
    assert.equal(investigation.type, 'biopsy');
    assert.equal(investigation.status, 'ordered');

    // Update investigation status
    const patchInvRes = await fetch(`${base}/api/investigations/${investigation.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': specialist.cookie,
        'X-CSRF-Token': specialist.csrf
      },
      body: JSON.stringify({
        status: 'reported',
        resultSummary: 'Histopathology: Hyperkeratosis with moderate dysplasia. No invasive carcinoma.'
      })
    });
    if (patchInvRes.status !== 200) {
      console.error('PATCH INV ERROR:', await patchInvRes.text());
    }
    assert.equal(patchInvRes.status, 200);

    // 4. Hospital Coordinator logs patient navigation
    const hospital = await loginAs('hospital@drishti.demo', 'Drishti@2026');
    const navRes = await fetch(`${base}/api/navigation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': hospital.cookie,
        'X-CSRF-Token': hospital.csrf
      },
      body: JSON.stringify({
        patientId: pId,
        contactStatus: 'contacted',
        transportBarrier: 'bus_fare_assistance_needed',
        attendanceConfirmed: true,
        notes: 'Arranged ITDA tribal patient vehicle voucher for Area Hospital visit.'
      })
    });
    assert.equal(navRes.status, 201);

    // 5. WebRTC Consultation Signaling
    const doctor = await loginAs('doctor@drishti.demo', 'Drishti@2026');
    const consultRes = await fetch(`${base}/api/consultations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': doctor.cookie,
        'X-CSRF-Token': doctor.csrf
      },
      body: JSON.stringify({
        patientId: pId,
        scheduledAt: new Date(Date.now() + 3600000).toISOString()
      })
    });
    assert.equal(consultRes.status, 201);
    const { consultation } = await consultRes.json();

    // Exchange signal (Offer)
    const sigSendRes = await fetch(`${base}/api/consultations/${consultation.id}/signals`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': doctor.cookie,
        'X-CSRF-Token': doctor.csrf
      },
      body: JSON.stringify({
        type: 'offer',
        payload: { sdp: 'v=0\r\no=- 12345 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n', type: 'offer' },
        recipient: 'patient'
      })
    });
    assert.equal(sigSendRes.status, 200);

    // Retrieve signals from peer perspective (patient receives the doctor's offer)
    const patientUser = await loginAs('patient@drishti.demo', 'Drishti@2026');
    const sigGetRes = await fetch(`${base}/api/consultations/${consultation.id}/signals?since=0`, {
      headers: { 'Cookie': patientUser.cookie }
    });
    assert.equal(sigGetRes.status, 200);
    const { signals } = await sigGetRes.json();
    assert.equal(signals.length, 1);
    assert.equal(signals[0].type, 'offer');

    // Save Consultation Outcome
    const outcomeRes = await fetch(`${base}/api/consultations/${consultation.id}/outcome`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': doctor.cookie,
        'X-CSRF-Token': doctor.csrf
      },
      body: JSON.stringify({
        notes: 'Follow-up in 14 days following biopsy result. Prescribed topical triamcinolone.',
        prescription: 'Topical Triamcinolone 0.1% oral paste twice daily.'
      })
    });
    assert.equal(outcomeRes.status, 200);

    // 6. District Dashboard Stats Aggregation
    const admin = await loginAs('admin@drishti.demo', 'Drishti@2026');
    const statsRes = await fetch(`${base}/api/dashboard/stats`, {
      headers: { 'Cookie': admin.cookie }
    });
    assert.equal(statsRes.status, 200);
    const { stats } = await statsRes.json();
    assert.ok(stats.totalPatients >= 1);
    assert.ok(stats.totalInvestigations >= 1);
    assert.ok(stats.totalConsultations >= 1);
    assert.ok(stats.villageBreakdown.some(v => v.village === 'Paderu'));

  } finally {
    server.close();
    await rm(dir, { recursive: true, force: true });
  }
});
