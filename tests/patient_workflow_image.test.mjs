import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer } from '../src/server.mjs';
import { generatePatientId, isValidPatientId } from '../src/patient-id.mjs';
import { getConsentTerms, CURRENT_CONSENT_VERSION } from '../src/consent-terms.mjs';
import { generateSyntheticCohort, SYNTHETIC_PNG_BASE64 } from '../src/synthetic-data.mjs';

test('patient workflow, multilingual consent, and decoupled image storage', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'drishti-p3-test-'));

  // 1. Patient ID generator and validator verification
  const id1 = generatePatientId();
  assert.match(id1, /^AD-\d{8}-[A-F0-9]{4}$/);
  assert.equal(isValidPatientId(id1), true);

  const customId = generatePatientId('AD-PAD');
  assert.match(customId, /^AD-PAD-\d{8}-[A-F0-9]{4}$/);
  assert.equal(isValidPatientId(customId), true);

  assert.equal(isValidPatientId('AD-E1A2B3C4'), true); // legacy format
  assert.equal(isValidPatientId('INVALID-ID'), false);
  assert.equal(isValidPatientId(''), false);
  assert.equal(isValidPatientId(null), false);

  // 2. Multilingual consent terms verification
  const enTerms = getConsentTerms(CURRENT_CONSENT_VERSION, 'en');
  assert.equal(enTerms.language, 'en');
  assert.ok(enTerms.body.includes('research assistance'));
  assert.ok(enTerms.body.includes('not constitute a final medical diagnosis'));
  assert.ok(enTerms.body.includes('withdraw this consent at any time'));

  const teTerms = getConsentTerms(CURRENT_CONSENT_VERSION, 'te');
  assert.equal(teTerms.language, 'te');
  assert.ok(teTerms.body.includes('పరిశోధన సహాయం'));
  assert.ok(teTerms.body.includes('సమ్మతిని ఉపసంహరించుకోవచ్చని'));

  // 3. Start test server
  const server = await startServer({
    port: 0,
    dataDir: directory,
    storageDir: directory,
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
    const contentType = r.headers.get('content-type') || '';
    const body = contentType.includes('application/json') ? await r.json() : await r.arrayBuffer();
    return { status: r.status, body, headers: r.headers, cookie: r.headers.get('set-cookie') };
  };

  try {
    // 4. Public endpoint: GET /api/consent/terms
    const termsRes = await request('/api/consent/terms?version=v1.0-ITDA&lang=te');
    assert.equal(termsRes.status, 200);
    assert.equal(termsRes.body.terms.language, 'te');
    assert.ok(termsRes.body.terms.body.length > 50);

    // 5. Sign in as worker and doctor
    const signIn = async (role) => {
      const a = accounts.find((acc) => acc.role === role);
      const r = await request('/api/auth/login', 'POST', { email: a.email, password: a.password });
      assert.equal(r.status, 200);
      return { cookie: r.cookie.split(';')[0], csrf: r.body.csrf, user: r.body.user };
    };

    const worker = await signIn('worker');
    const doctor = await signIn('doctor');

    // 6. Decoupled image upload on registration (POST /api/patients)
    const patientData = {
      id: generatePatientId('AD-PAD'),
      name: 'Somulu Killo',
      age: 48,
      village: 'Araku Valley',
      history: 'Betel nut staining on anterior teeth',
      consent: true,
      consentVersion: 'v1.0-ITDA',
      consentLanguage: 'te',
      photo: SYNTHETIC_PNG_BASE64,
    };

    const regRes = await request('/api/patients', 'POST', patientData, worker);
    assert.equal(regRes.status, 201);
    const created = regRes.body.patient;
    assert.equal(created.id, patientData.id);

    // Verify image was decoupled: photo URL must be /api/images/IMG-..., NOT giant base64
    assert.match(created.photo, /^\/api\/images\/IMG-[A-F0-9]+$/);
    assert.match(created.imageId, /^IMG-[A-F0-9]+$/);

    // Verify image file exists on disk in storage directory
    const foundImage = existsSync(join(directory, 'images')) || existsSync(join(directory, 'storage', 'images'));
    assert.equal(foundImage, true);

    // 7. Unauthenticated image access is rejected (HTTP 401)
    const unauthImageRes = await request(created.photo, 'GET');
    assert.equal(unauthImageRes.status, 401);

    // 8. Authenticated image retrieval (HTTP 200) with security headers
    const imageRes = await request(created.photo, 'GET', undefined, doctor);
    assert.equal(imageRes.status, 200);
    assert.equal(imageRes.headers.get('content-type'), 'image/png');
    assert.equal(imageRes.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(imageRes.headers.get('cache-control'), 'private, max-age=86400');
    assert.ok(Buffer.from(imageRes.body).length > 0);

    // 9. Separate image attachment endpoint (POST /api/patients/:id/image)
    const attachRes = await request(
      `/api/patients/${created.id}/image`,
      'POST',
      { photo: SYNTHETIC_PNG_BASE64 },
      worker
    );
    assert.equal(attachRes.status, 200);
    assert.equal(attachRes.body.ok, true);
    assert.match(attachRes.body.image.url, /^\/api\/images\/IMG-/);
    assert.equal(attachRes.body.patient.timeline.some((t) => t.text.includes('Oral photograph uploaded')), true);

    // 10. Malicious script injection disguised as image is rejected (HTTP 400)
    const evilPayload = 'data:image/png;base64,' + Buffer.from('<script>alert("hack")</script>').toString('base64');
    const evilRes = await request(
      `/api/patients/${created.id}/image`,
      'POST',
      { photo: evilPayload },
      worker
    );
    assert.equal(evilRes.status, 400);

    // 11. Image upload blocked when consent is withdrawn (HTTP 403)
    const withdrawRes = await request(
      `/api/patients/${created.id}/consent/withdraw`,
      'POST',
      { reason: 'Patient opted out of photographic screening' },
      worker
    );
    assert.equal(withdrawRes.status, 200);
    assert.equal(withdrawRes.body.patient.consent, false);

    const postWithdrawImageRes = await request(
      `/api/patients/${created.id}/image`,
      'POST',
      { photo: SYNTHETIC_PNG_BASE64 },
      worker
    );
    assert.equal(postWithdrawImageRes.status, 403);
    assert.ok(postWithdrawImageRes.body.error.includes('Active patient consent is required'));

    // 12. Synthetic cohort generator produces compliant records without PII
    const cohort = generateSyntheticCohort(5);
    assert.equal(cohort.length, 5);
    for (const p of cohort) {
      assert.match(p.id, /^AD-PAD-\d{8}-[A-F0-9]{4}$/);
      assert.ok(p.age >= 18 && p.age <= 120);
      assert.ok(p.village.length > 0);
      assert.equal(p.consent, true);
      assert.equal(p.consentVersion, 'v1.0-ITDA');
      assert.match(p.photo, /^data:image\/png;base64,/);
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
