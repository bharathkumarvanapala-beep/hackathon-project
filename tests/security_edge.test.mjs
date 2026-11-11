import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer } from '../src/server.mjs';

test('Security & Boundary Defenses: rate limiting, payload security, magic bytes, CSRF, and consent gates', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'drishti-security-edge-'));
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
    // 1. Brute-Force Rate Limiting (HTTP 429)
    // Perform 10 failed sign-in attempts
    const attackerEmail = 'attacker@example.org';
    for (let i = 1; i <= 10; i++) {
      const failedRes = await request('/api/auth/login', 'POST', {
        email: attackerEmail,
        password: `wrong-password-${i}`
      });
      assert.equal(failedRes.status, 401, `Attempt ${i} should be 401 unauthorized`);
    }

    // The 11th attempt must trigger rate-limiting HTTP 429
    const rateLimitedRes = await request('/api/auth/login', 'POST', {
      email: attackerEmail,
      password: 'wrong-password-11'
    });
    assert.equal(rateLimitedRes.status, 429, '11th attempt must be blocked by rate limiter');
    assert.match(
      String(rateLimitedRes.body.error),
      /Too many sign-in attempts/i,
      'Error message must state too many sign-in attempts'
    );

    // 2. Legitimate logins for security test personas
    const worker = await signIn('worker');
    const doctor = await signIn('doctor');

    // 3. CSRF & Origin Attacks
    const pSample = {
      id: 'AD-SEC-PATIENT-1',
      name: 'Security Test Patient',
      age: 40,
      village: 'Paderu',
      history: 'None',
      consent: true
    };

    // Missing CSRF token
    const missingCsrfRes = await request('/api/patients', 'POST', pSample, {
      ...worker,
      csrf: ''
    });
    assert.equal(missingCsrfRes.status, 403, 'Missing CSRF must return 403 Forbidden');

    // Forged CSRF token
    const forgedCsrfRes = await request('/api/patients', 'POST', pSample, {
      ...worker,
      csrf: 'invalid-forged-csrf-token-1234567890'
    });
    assert.equal(forgedCsrfRes.status, 403, 'Forged CSRF must return 403 Forbidden');

    // Untrusted Origin header
    const badOriginRes = await request('/api/patients', 'POST', pSample, worker, {
      Origin: 'https://evil-phishing-attacker.com'
    });
    assert.equal(badOriginRes.status, 403, 'Untrusted Origin must return 403 Forbidden');

    // 4. Role Escalation Defenses
    // Worker cannot run AI inference
    const workerAiRes = await request(
      '/api/patients/AD-SEC-PATIENT-1/research-ai',
      'POST',
      { researchAcknowledged: true },
      worker
    );
    assert.equal(workerAiRes.status, 403, 'Worker must be blocked from clinical AI execution');

    // Worker cannot switch active AI model
    const workerModelRes = await request(
      '/api/ai/select-model',
      'POST',
      { modelId: 'mock-multiclass' },
      worker
    );
    assert.equal(workerModelRes.status, 403, 'Worker must be blocked from selecting AI models');

    // Doctor cannot register a screening (worker-only intake role)
    const doctorScreeningRes = await request('/api/patients', 'POST', pSample, doctor);
    assert.equal(doctorScreeningRes.status, 403, 'Doctor must be blocked from initial screening intake');

    // 5. Payload Malformation & Malicious Injections
    // Register the valid patient first
    const createPatientRes = await request('/api/patients', 'POST', pSample, worker);
    assert.equal(createPatientRes.status, 201);

    // Malicious script injection disguised as JPEG
    const maliciousHtmlPayload =
      'data:image/jpeg;base64,' +
      Buffer.from('<html><head></head><body><script>alert("XSS")</script></body></html>').toString('base64');
    const xssUploadRes = await request(
      `/api/patients/${pSample.id}/image`,
      'POST',
      { photo: maliciousHtmlPayload },
      worker
    );
    assert.equal(
      xssUploadRes.status,
      400,
      'HTML/Script content disguised as JPEG must be rejected by magic byte validator'
    );

    // PHP executable injection disguised as JPEG
    const maliciousPhpPayload =
      'data:image/jpeg;base64,' +
      Buffer.from('<?php phpinfo(); system($_GET["cmd"]); ?>').toString('base64');
    const phpUploadRes = await request(
      `/api/patients/${pSample.id}/image`,
      'POST',
      { photo: maliciousPhpPayload },
      worker
    );
    assert.equal(
      phpUploadRes.status,
      400,
      'PHP executable payload disguised as JPEG must be rejected by magic byte validator'
    );

    // Corrupted / truncated Base64 string
    const corruptedBase64Res = await request(
      `/api/patients/${pSample.id}/image`,
      'POST',
      { photo: 'data:image/jpeg;base64,NOT_VALID_BASE64_!!!@@@###$$$' },
      worker
    );
    assert.equal(
      corruptedBase64Res.status,
      400,
      'Corrupted Base64 string must return 400 without crashing the server'
    );

    // 6. Consent Gating Defense: Withdrawal and Immediate AI Lockout
    // Upload a valid JPEG fixture to the patient
    const validJpegBytes = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
      0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
      0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
      0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
      0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20,
      0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29,
      0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32,
      0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x10,
      0x00, 0x10, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00,
      0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
      0x09, 0x0a, 0x0b, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f,
      0x00, 0xbf, 0x00, 0xff, 0xd9
    ]);
    const validPhotoDataUrl =
      'data:image/jpeg;base64,' + validJpegBytes.toString('base64');

    const validPhotoRes = await request(
      `/api/patients/${pSample.id}/image`,
      'POST',
      { photo: validPhotoDataUrl },
      worker
    );
    assert.equal(validPhotoRes.status, 200, 'Valid JPEG fixture must upload successfully');

    // Withdraw consent for this patient
    const withdrawRes = await request(
      `/api/patients/${pSample.id}/consent/withdraw`,
      'POST',
      { reason: 'Patient requested withdrawal under DPDP Act 2023' },
      doctor
    );
    assert.equal(withdrawRes.status, 200);
    assert.equal(withdrawRes.body.consent.status, 'withdrawn');

    // Attempting research AI on consent-withdrawn patient must be rejected with 403
    const aiAfterWithdrawRes = await request(
      `/api/patients/${pSample.id}/research-ai`,
      'POST',
      { researchAcknowledged: true, version: 3 },
      doctor
    );
    assert.equal(
      aiAfterWithdrawRes.status,
      403,
      'Research AI must be strictly blocked on consent-withdrawn patient'
    );
    assert.match(
      aiAfterWithdrawRes.body.error,
      /Active patient consent is required/i
    );

    // Attempting photo upload on consent-withdrawn patient must also be rejected with 403
    const photoAfterWithdrawRes = await request(
      `/api/patients/${pSample.id}/image`,
      'POST',
      { photo: validPhotoDataUrl },
      worker
    );
    assert.equal(
      photoAfterWithdrawRes.status,
      403,
      'Image upload must be strictly blocked on consent-withdrawn patient'
    );

    // 7. Session Invalidation via Logout
    const logoutRes = await request('/api/auth/logout', 'POST', {}, worker);
    assert.equal(logoutRes.status, 200);

    // Subsequent access with logged-out cookie must return 401 Unauthorized
    const postLogoutRes = await request('/api/patients', 'GET', undefined, worker);
    assert.equal(
      postLogoutRes.status,
      401,
      'Access after logout must return 401 Unauthorized'
    );

    // 8. SQL Injection & Path Traversal Sanitization
    const sqlInjRes = await request(
      "/api/patients/AD-'; DROP TABLE patients;--/consent",
      'GET',
      undefined,
      doctor
    );
    assert.equal(sqlInjRes.status, 404, 'SQL injection in URL path must safely return 404 without execution');

    const db = new DatabaseSync(join(directory, 'drishti.sqlite'));
    db.prepare('UPDATE sessions SET expires=? WHERE user_id=?').run(
      Date.now() - 60000,
      doctor.user.id
    );
    db.close();

    const expiredSessionRes = await request('/api/patients', 'GET', undefined, doctor);
    assert.equal(
      expiredSessionRes.status,
      401,
      'Expired session must be strictly rejected with 401 Unauthorized'
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
