import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  BaseAIModelAdapter,
  ToothAgenesisSigLIP2Adapter,
  UmlomoAdapter,
  MockSimulatedAIAdapter,
  AIAdapterRegistry,
  getDefaultAIRegistry,
} from '../src/ai-adapter.mjs';
import { startServer } from '../src/server.mjs';

test('AI Adapter Framework: adapter contracts, candidate findings, and clinical guardrails', async () => {
  // 1. BaseAIModelAdapter contract
  const base = new BaseAIModelAdapter({ id: 'test-base', name: 'Test Base' });
  assert.equal(base.researchOnly, true);
  assert.equal(base.clinicallyValidated, false);
  await assert.rejects(() => base.analyze('data:...'), /must be implemented/);
  const baseAvail = await base.checkAvailability();
  assert.equal(baseAvail.available, false);
  assert.equal(baseAvail.researchOnly, true);

  // 2. ToothAgenesisSigLIP2Adapter (Google SigLIP2 fine-tune for 6 oral categories)
  const siglip2 = new ToothAgenesisSigLIP2Adapter();
  assert.equal(siglip2.id, 'prithivMLmods/tooth-agenesis-siglip2');
  assert.equal(siglip2.architecture, 'google/siglip2-base-patch16-512');
  assert.deepEqual(siglip2.classes, [
    'Calculus',
    'Caries',
    'Gingivitis',
    'Mouth Ulcer',
    'Tooth Discoloration',
    'Hypodontia',
  ]);

  const siglipAvail = await siglip2.checkAvailability();
  assert.equal(siglipAvail.available, true);
  assert.equal(siglipAvail.researchOnly, true);
  assert.equal(siglipAvail.clinicallyValidated, false);
  assert.equal(siglipAvail.classes.length, 6);

  const dummyPhoto = 'data:image/png;base64,' + Buffer.from('dummy-valid-base64-photo-data-bytes').toString('base64');
  const siglipResult = await siglip2.analyze(dummyPhoto);
  assert.ok(siglipResult.modelClass);
  assert.ok(siglip2.classes.includes(siglipResult.modelClass));
  assert.equal(siglipResult.researchOnly, true);
  assert.equal(siglipResult.clinicallyValidated, false);
  assert.equal(siglipResult.candidateFindings.length, 6);
  assert.ok(siglipResult.warnings.some((w) => w.includes('Softmax')));
  assert.ok(siglipResult.warnings.some((w) => w.includes('Does not replace')));

  // 3. UmlomoAdapter (MobileNetV2 2-class)
  const umlomo = new UmlomoAdapter();
  assert.equal(umlomo.id, 'Al04ni/Umlomo');
  assert.deepEqual(umlomo.classes, ['Normal', 'Oral Cancer']);
  const umlomoResult = await umlomo.analyze(dummyPhoto);
  assert.ok(['Normal', 'Oral Cancer'].includes(umlomoResult.modelClass));
  assert.equal(umlomoResult.candidateFindings.length, 2);
  assert.equal(umlomoResult.researchOnly, true);

  // 4. MockSimulatedAIAdapter
  const mock = new MockSimulatedAIAdapter('Caries');
  const mockResult = await mock.analyze(dummyPhoto, { forcedClass: 'Gingivitis' });
  assert.equal(mockResult.modelClass, 'Gingivitis');
  assert.equal(mockResult.simulation, true);

  // 5. AIAdapterRegistry
  const registry = new AIAdapterRegistry('prithivMLmods/tooth-agenesis-siglip2');
  const models = registry.listAdapters();
  assert.ok(models.length >= 3);
  const siglipEntry = models.find((m) => m.id === 'prithivMLmods/tooth-agenesis-siglip2');
  assert.ok(siglipEntry);
  assert.equal(siglipEntry.active, true);

  // Switch model
  const switched = registry.setActiveAdapter('Al04ni/Umlomo');
  assert.equal(switched, true);
  assert.equal(registry.activeModelId, 'Al04ni/Umlomo');

  const inference = await registry.runInference(dummyPhoto);
  assert.equal(inference.model, 'Al04ni/Umlomo');

  // Unknown model switch fails gracefully
  assert.equal(registry.setActiveAdapter('non-existent-id'), false);
});

test('AI HTTP endpoints: model discovery, switching, multi-class analysis, and audit ledger', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'drishti-ai-test-'));
  const dummyPhoto = 'data:image/jpeg;base64,' + Buffer.from('dummy-valid-base64-photo-data-bytes').toString('base64');

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

    // 1. GET /api/ai/models - discover available models
    const modelsRes = await request('/api/ai/models', 'GET', null, doctor);
    assert.equal(modelsRes.status, 200);
    assert.ok(Array.isArray(modelsRes.body.models));
    assert.ok(modelsRes.body.models.some((m) => m.id === 'prithivMLmods/tooth-agenesis-siglip2'));
    assert.ok(modelsRes.body.models.some((m) => m.id === 'Al04ni/Umlomo'));

    // 2. POST /api/ai/select-model - access control and model switching
    // Worker cannot switch models
    const workerSwitch = await request('/api/ai/select-model', 'POST', { modelId: 'Al04ni/Umlomo' }, worker);
    assert.equal(workerSwitch.status, 403);

    // Doctor can switch model
    const doctorSwitch = await request(
      '/api/ai/select-model',
      'POST',
      { modelId: 'Al04ni/Umlomo' },
      doctor
    );
    assert.equal(doctorSwitch.status, 200);
    assert.equal(doctorSwitch.body.active, 'Al04ni/Umlomo');

    // Switch back to SigLIP2
    await request(
      '/api/ai/select-model',
      'POST',
      { modelId: 'prithivMLmods/tooth-agenesis-siglip2' },
      doctor
    );

    // Invalid model id returns 400
    const invalidSwitch = await request(
      '/api/ai/select-model',
      'POST',
      { modelId: 'invalid-model-name-xyz' },
      doctor
    );
    assert.equal(invalidSwitch.status, 400);

    // 3. Register a patient with consent and photo
    const patientData = {
      id: 'AD-AI-PATIENT-001',
      name: 'Rambabu Korra',
      age: 38,
      village: 'Paderu Main',
      history: 'White patch on buccal mucosa, tobacco chewer for 12 years',
      consent: true,
      consentVersion: 'v1.0-ITDA',
      consentLanguage: 'te',
      photo: dummyPhoto,
    };
    const regRes = await request('/api/patients', 'POST', patientData, worker);
    assert.equal(regRes.status, 201);
    const patient = regRes.body.patient;

    // 4. Run AI Inference (Doctor only)
    // Worker running AI must be rejected
    const workerAi = await request(
      `/api/patients/${patient.id}/research-ai`,
      'POST',
      { version: patient.version, researchAcknowledged: true },
      worker
    );
    assert.equal(workerAi.status, 403);

    // Doctor without research acknowledgement must be rejected
    const noAckAi = await request(
      `/api/patients/${patient.id}/research-ai`,
      'POST',
      { version: patient.version, researchAcknowledged: false },
      doctor
    );
    assert.equal(noAckAi.status, 400);

    // Doctor with valid acknowledgement runs SigLIP2 analysis
    const doctorAi = await request(
      `/api/patients/${patient.id}/research-ai`,
      'POST',
      {
        version: patient.version,
        researchAcknowledged: true,
        modelId: 'prithivMLmods/tooth-agenesis-siglip2',
      },
      doctor
    );
    assert.equal(doctorAi.status, 200);
    assert.ok(doctorAi.body.patient.researchAI);
    assert.equal(doctorAi.body.patient.researchAI.model, 'prithivMLmods/tooth-agenesis-siglip2');
    assert.equal(doctorAi.body.patient.researchAI.candidateFindings.length, 6);
    assert.ok(doctorAi.body.analysis.id);
    assert.ok(doctorAi.body.analysis.candidateFindings);

    // 5. Query historical AI analyses ledger: GET /api/patients/:id/ai-analyses
    const ledgerRes = await request(`/api/patients/${patient.id}/ai-analyses`, 'GET', null, doctor);
    assert.equal(ledgerRes.status, 200);
    assert.ok(Array.isArray(ledgerRes.body.analyses));
    assert.equal(ledgerRes.body.analyses.length, 1);
    const record = ledgerRes.body.analyses[0];
    assert.equal(record.patientId, patient.id);
    assert.equal(record.modelName, 'prithivMLmods/tooth-agenesis-siglip2');
    assert.equal(record.status, 'completed');
    assert.equal(record.candidateFindings.length, 6);
    assert.ok(Array.isArray(record.warnings));

    // Unknown patient returns 404
    const unknownPatient = await request('/api/patients/AD-UNKNOWN-999/ai-analyses', 'GET', null, doctor);
    assert.equal(unknownPatient.status, 404);

    // 6. Withdraw consent and verify AI is strictly blocked
    const withdrawRes = await request(
      `/api/patients/${patient.id}/consent/withdraw`,
      'POST',
      { reason: 'Patient requested AI opt-out' },
      doctor
    );
    assert.equal(withdrawRes.status, 200);

    // AI execution must now fail with 403 Forbidden
    const blockedAi = await request(
      `/api/patients/${patient.id}/research-ai`,
      'POST',
      { version: withdrawRes.body.patient.version, researchAcknowledged: true },
      doctor
    );
    assert.equal(blockedAi.status, 403);
    assert.ok(blockedAi.body.error.includes('Active patient consent is required'));

  } finally {
    server.close();
  }
});
