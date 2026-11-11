import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer } from '../src/server.mjs';

test('consent lifecycle: versioned recording, withdrawal, and blocking AI processing without consent', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'drishti-consent-test-'));
  const dummyPhoto = 'data:image/jpeg;base64,' + Buffer.from('dummy-valid-base64-photo-data-bytes').toString('base64');
  const mockAI = async () => ({
    model: 'mock-research-model',
    modelClass: 'Normal',
    revision: 'test-rev',
    researchOnly: true,
    clinicallyValidated: false,
  });

  const server = await startServer({
    port: 0,
    dataDir: directory,
    researchAI: mockAI,
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
    // 1. Sign in as worker and doctor
    const signIn = async (role) => {
      const a = accounts.find((acc) => acc.role === role);
      const r = await request('/api/auth/login', 'POST', { email: a.email, password: a.password });
      assert.equal(r.status, 200);
      return { ...r.body, cookie: r.cookie.split(';')[0] };
    };
    const worker = await signIn('worker');
    const doctor = await signIn('doctor');

    // 2. Register patient with explicit versioned consent
    const patientData = {
      id: 'AD-CONSENT-001',
      name: 'Lakshmi Devi',
      age: 42,
      village: 'Araku Valley',
      history: 'Mild swelling for 3 weeks',
      consent: true,
      consentVersion: 'v1.0-ITDA',
      consentLanguage: 'te',
      consentText: 'ఈ ప్రదర్శనను వివరించి అనుమతి పొందాను.',
      photo: dummyPhoto,
    };
    const createRes = await request('/api/patients', 'POST', patientData, worker);
    assert.equal(createRes.status, 201);
    assert.equal(createRes.body.patient.consent, true);

    // 3. Verify consent details via GET endpoint
    const consentRes = await request(`/api/patients/${patientData.id}/consent`, 'GET', undefined, worker);
    assert.equal(consentRes.status, 200);
    assert.equal(consentRes.body.consent.version, 'v1.0-ITDA');
    assert.equal(consentRes.body.consent.language, 'te');
    assert.equal(consentRes.body.consent.status, 'granted');

    // 4. Doctor runs AI successfully while consent is active
    const aiSuccessRes = await request(`/api/patients/${patientData.id}/research-ai`, 'POST', {
      version: 1,
      researchAcknowledged: true,
    }, doctor);
    assert.equal(aiSuccessRes.status, 200);
    assert.ok(aiSuccessRes.body.patient.researchAI);

    // 5. Withdraw consent
    const withdrawRes = await request(`/api/patients/${patientData.id}/consent/withdraw`, 'POST', {
      reason: 'Patient chose not to participate further in AI screening',
    }, worker);
    assert.equal(withdrawRes.status, 200);
    assert.equal(withdrawRes.body.consent.status, 'withdrawn');
    assert.equal(withdrawRes.body.patient.consent, false);

    // 6. Verify AI processing is strictly blocked once consent is withdrawn
    const aiBlockedRes = await request(`/api/patients/${patientData.id}/research-ai`, 'POST', {
      version: 3,
      researchAcknowledged: true,
    }, doctor);
    assert.equal(aiBlockedRes.status, 403);
    assert.match(aiBlockedRes.body.error, /consent/i);

    // 7. Verify full consent history
    const historyRes = await request(`/api/patients/${patientData.id}/consents`, 'GET', undefined, worker);
    assert.equal(historyRes.status, 200);
    assert.ok(Array.isArray(historyRes.body.consents));
    assert.ok(historyRes.body.consents.length >= 1);

    // 8. Password change security
    const aWorker = accounts.find((a) => a.role === 'worker');
    const pwdShortRes = await request('/api/auth/change-password', 'POST', {
      currentPassword: aWorker.password,
      newPassword: 'short',
    }, worker);
    assert.equal(pwdShortRes.status, 400);

    const pwdWrongRes = await request('/api/auth/change-password', 'POST', {
      currentPassword: 'WrongPassword123!',
      newPassword: 'NewSecurePassword123!',
    }, worker);
    assert.equal(pwdWrongRes.status, 401);

    const pwdSuccessRes = await request('/api/auth/change-password', 'POST', {
      currentPassword: aWorker.password,
      newPassword: 'NewSecurePassword123!',
    }, worker);
    assert.equal(pwdSuccessRes.status, 200);

    // Verify login with new password works
    const newLoginRes = await request('/api/auth/login', 'POST', {
      email: aWorker.email,
      password: 'NewSecurePassword123!',
    });
    assert.equal(newLoginRes.status, 200);

    // 9. Admin provisions specialist and navigator roles
    const admin = await signIn('admin');
    const bulkRolesRes = await request('/api/admin/users/bulk', 'POST', {
      users: [
        { email: 'specialist@drishti.local', name: 'Dr. Specialist', role: 'specialist' },
        { email: 'navigator@drishti.local', name: 'Care Navigator', role: 'navigator' },
      ],
    }, admin);
    assert.equal(bulkRolesRes.status, 201);
    assert.equal(bulkRolesRes.body.accounts.length, 2);

    // 10. Verify admin audit log recorded consent and auth events
    const auditRes = await request('/api/admin/audit', 'GET', undefined, admin);
    assert.equal(auditRes.status, 200);
    const actions = auditRes.body.audit.map((a) => a.action);
    assert.ok(actions.includes('consent.withdrawn'));
    assert.ok(actions.includes('auth.password_changed'));
    assert.ok(actions.includes('accounts.bulk_created'));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
