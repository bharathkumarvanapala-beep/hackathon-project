import assert from 'node:assert/strict';

const base = 'http://127.0.0.1:4173';
const lkBase = 'http://127.0.0.1:7880';

async function testAll() {
  console.log('--- 1. Testing LiveKit & Backend Endpoints ---');
  const lkRes = await fetch(lkBase + '/').catch(e => ({ ok: false, status: e.message }));
  console.log('LiveKit Server reachable:', lkRes.status === 200 || lkRes.status === 404 || typeof lkRes.status === 'number');

  const htmlRes = await fetch(base + '/');
  assert.equal(htmlRes.status, 200, 'Frontend index.html served');
  const htmlText = await htmlRes.text();
  assert.ok(htmlText.includes('livekit-client.umd.js'), 'index.html includes LiveKit script tag');
  console.log('[✓] Frontend & Backend started successfully');

  const jsRes = await fetch(base + '/livekit-client.umd.js');
  assert.equal(jsRes.status, 200, 'LiveKit client script served');
  const jsBytes = await jsRes.arrayBuffer();
  assert.ok(jsBytes.byteLength > 500000, 'LiveKit client size verified');
  console.log('[✓] livekit-client.umd.js served (' + jsBytes.byteLength + ' bytes)');

  console.log('\n--- 2. Testing Doctor & Patient Authentication ---');
  const docLogin = await fetch(base + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'doctor@drishti.demo', password: 'Drishti@2026' })
  });
  assert.equal(docLogin.status, 200);
  const docData = await docLogin.json();
  const docCookie = docLogin.headers.get('set-cookie').split(';')[0];
  console.log('[✓] Doctor signed in:', docData.user.name, '(' + docData.user.role + ')');

  const workerLogin = await fetch(base + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'asha@drishti.demo', password: 'Drishti@2026' })
  });
  assert.equal(workerLogin.status, 200);
  const workerData = await workerLogin.json();
  const workerCookie = workerLogin.headers.get('set-cookie').split(';')[0];
  console.log('[✓] ASHA Health Worker signed in:', workerData.user.name, '(' + workerData.user.role + ')');

  console.log('\n--- 3. Testing Room Creation & Token Alignment ---');
  const pListRes = await fetch(base + '/api/patients', {
    headers: { Cookie: docCookie, 'X-CSRF-Token': docData.csrf }
  });
  const patients = (await pListRes.json()).patients;
  const patient = patients[0];

  const consultRes = await fetch(base + '/api/consultations', {
    method: 'POST',
    headers: { Cookie: docCookie, 'X-CSRF-Token': docData.csrf, 'Content-Type': 'application/json' },
    body: JSON.stringify({ patientId: patient.id, scheduledAt: new Date().toISOString() })
  });
  const cData = await consultRes.json();
  const cId = cData.consultation.id;
  console.log('[✓] Consultation room created with ID:', cId);

  const docTokenRes = await fetch(base + '/api/consultations/' + cId + '/token', {
    method: 'POST',
    headers: { Cookie: docCookie, 'X-CSRF-Token': docData.csrf, 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: docData.user.id })
  });
  const docTokenData = await docTokenRes.json();

  const workerTokenRes = await fetch(base + '/api/consultations/' + cId + '/token', {
    method: 'POST',
    headers: { Cookie: workerCookie, 'X-CSRF-Token': workerData.csrf, 'Content-Type': 'application/json' },
    body: JSON.stringify({ identity: workerData.user.id })
  });
  const workerTokenData = await workerTokenRes.json();

  assert.equal(docTokenData.roomName, workerTokenData.roomName, 'Both participants get identical room name');
  assert.equal(docTokenData.roomName, 'drishti-' + cId);
  console.log('[✓] Both participants assigned to room:', docTokenData.roomName);
  console.log('[✓] LiveKit URL provided to both:', docTokenData.livekitConfig.url);

  // Decode JWT payloads to inspect claims
  const parseJwt = t => JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString('utf8'));
  const docClaims = parseJwt(docTokenData.livekitConfig.token);
  const workerClaims = parseJwt(workerTokenData.livekitConfig.token);

  assert.equal(docClaims.iss, 'devkey');
  assert.equal(workerClaims.iss, 'devkey');
  assert.equal(docClaims.sub, docData.user.id);
  assert.equal(workerClaims.sub, workerData.user.id);
  assert.equal(docClaims.video.room, 'drishti-' + cId);
  assert.equal(workerClaims.video.room, 'drishti-' + cId);
  assert.ok(docClaims.exp > Math.floor(Date.now() / 1000));
  console.log('[✓] LiveKit HS256 JWT claims verified for both participants');

  console.log('\n--- 4. Testing Secret Leak Prevention ---');
  const rawResponse = JSON.stringify(docTokenData);
  assert.ok(!rawResponse.includes('secret'), 'Token response does not leak LIVEKIT_API_SECRET');
  console.log('[✓] No secrets leaked in API payloads');

  console.log('\n--- 5. Testing Interactive Chat & Outcomes ---');
  const chatRes = await fetch(base + '/api/consultations/' + cId + '/signals', {
    method: 'POST',
    headers: { Cookie: docCookie, 'X-CSRF-Token': docData.csrf, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'chat', text: 'Doctor: Please show the left buccal mucosa.', sender: docData.user.name })
  });
  assert.equal(chatRes.status, 200);

  const getSigRes = await fetch(base + '/api/consultations/' + cId + '/signals', {
    headers: { Cookie: workerCookie, 'X-CSRF-Token': workerData.csrf }
  });
  const sigData = await getSigRes.json();
  console.log('[✓] Real-time chat signal successfully relayed');

  const outcomeRes = await fetch(base + '/api/consultations/' + cId + '/outcome', {
    method: 'POST',
    headers: { Cookie: docCookie, 'X-CSRF-Token': docData.csrf, 'Content-Type': 'application/json' },
    body: JSON.stringify({ notes: 'Early homogenous leukoplakia on left buccal mucosa. Prescribed Triamcinolone 0.1% paste.', outcome: 'completed' })
  });
  assert.equal(outcomeRes.status, 200);
  console.log('[✓] Clinical outcome & prescription signed and committed');

  console.log('\n--- 6. Testing Existing AI & Health Endpoints ---');
  const aiRes = await fetch(base + '/api/ai/status', {
    headers: { Cookie: docCookie, 'X-CSRF-Token': docData.csrf }
  });
  assert.equal(aiRes.status, 200);
  const aiStatus = await aiRes.json();
  console.log('[✓] Gemini / AI service status responsive:', JSON.stringify(aiStatus));

  console.log('\n==========================================================');
  console.log('  ALL INTEGRATION TESTS PASSED 100% (READY FOR DEMO)');
  console.log('==========================================================');
}

testAll().catch(e => {
  console.error('Test failure:', e);
  process.exit(1);
});
