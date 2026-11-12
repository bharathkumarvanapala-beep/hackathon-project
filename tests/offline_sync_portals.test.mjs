import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer } from '../src/server.mjs';

function createMemoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear()
  };
}

function createMockIndexedDB() {
  const databases = new Map();
  const makeRequest = () => ({ onsuccess: null, onerror: null, onupgradeneeded: null, result: null, error: null });

  return {
    open(name, version = 1) {
      const req = makeRequest();
      queueMicrotask(() => {
        let db = databases.get(name);
        const isNew = !db || db.version < version;
        if (!db) {
          db = { version, stores: new Map() };
          databases.set(name, db);
        }
        const handle = {
          objectStoreNames: { contains: (s) => db.stores.has(s) },
          createObjectStore: (s, opts) => {
            if (!db.stores.has(s)) db.stores.set(s, { keyPath: opts?.keyPath || 'id', rows: new Map() });
            return db.stores.get(s);
          },
          transaction: (storeName) => {
            const store = db.stores.get(storeName);
            const tx = { oncomplete: null, onerror: null, error: null };
            const wrap = (fn) => {
              const r = { result: undefined, error: null };
              try {
                r.result = fn();
                queueMicrotask(() => tx.oncomplete && tx.oncomplete());
              } catch (err) {
                r.error = err;
                tx.error = err;
                queueMicrotask(() => tx.onerror && tx.onerror());
              }
              return r;
            };
            tx.objectStore = () => ({
              getAll: () => wrap(() => Array.from(store.rows.values()).map((v) => structuredClone(v))),
              get: (k) => wrap(() => (store.rows.has(k) ? structuredClone(store.rows.get(k)) : undefined)),
              put: (val) => wrap(() => { store.rows.set(val[store.keyPath], structuredClone(val)); return val[store.keyPath]; }),
              delete: (k) => wrap(() => { store.rows.delete(k); })
            });
            return tx;
          },
          close: () => {}
        };
        req.result = handle;
        if (isNew && req.onupgradeneeded) {
          db.version = version;
          req.onupgradeneeded();
        }
        if (req.onsuccess) req.onsuccess();
      });
      return req;
    }
  };
}

test('Offline Sync across All Portals: IndexedDB v2 outbox, role actions, and server reconciliation', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'drishti-offline-portals-'));
  const server = await startServer({
    port: 0,
    dataDir: dir,
    storageDir: join(dir, 'storage'),
    rateLimitMax: 1000
  });

  const base = `http://127.0.0.1:${server.address().port}`;
  let cookieJar = '';
  let online = true;
  const origFetch = globalThis.fetch;
  const origNavDesc = Object.getOwnPropertyDescriptor(globalThis, 'navigator');

  globalThis.window = globalThis.window || { addEventListener: () => {} };
  globalThis.sessionStorage = createMemoryStorage();
  globalThis.localStorage = createMemoryStorage();
  globalThis.indexedDB = createMockIndexedDB();
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      get onLine() {
        return online;
      },
      userAgent: 'node-test'
    }
  });
  globalThis.fetch = async (url, opts = {}) => {
    const target = String(url).startsWith('http') ? url : base + url;
    const headers = { ...(opts.headers || {}), ...(cookieJar ? { Cookie: cookieJar } : {}) };
    const res = await origFetch(target, { ...opts, headers });
    const sc = res.headers.get('set-cookie');
    if (sc) cookieJar = sc.split(';')[0];
    return res;
  };

  try {
    const client = await import('../public/client.js');

    // 1. ASHA Worker signs in, goes offline, creates screening, reconnects & syncs
    await client.login('asha@drishti.demo', 'Drishti@2026');
    await client.openCache();

    online = false;
    const pId = 'AD-OFFLINE-PORTAL-1';
    await client.createScreening({
      id: pId,
      name: 'Killo Mangamma',
      age: 46,
      village: 'Hukumpeta',
      phone: '9848099887',
      history: 'Cheek irritation for 3 weeks',
      consent: true,
      stage: 'screened',
      photo: null,
      createdAt: new Date().toISOString(),
      timeline: []
    });
    assert.equal((await client.localPatients()).length, 1);

    online = true;
    const workerSync = await client.syncRecords();
    assert.equal(workerSync.uploaded, 1);
    const sharedPatient = (await client.localPatients()).find((p) => p.id === pId);
    assert.equal(sharedPatient._sync, 'shared');
    assert.equal(sharedPatient.version, 1);
    await client.logout();
    cookieJar = '';

    // 2. Doctor signs in, syncs shared patient, goes offline, reviews & refers
    await client.login('doctor@drishti.demo', 'Drishti@2026');
    await client.openCache();
    await client.syncRecords();
    const docPatient = (await client.localPatients()).find((p) => p.id === pId);
    assert.ok(docPatient);

    online = false;
    await client.reviewPatient({
      ...docPatient,
      stage: 'referred',
      facility: 'Area Hospital Paderu',
      due: '2026-12-20',
      quadrant: 'MUCOSA',
      priority: 'urgent',
      notes: 'Offline clinical review queued for biopsy.'
    });
    assert.equal((await client.localOutbox()).length, 1);
    assert.equal((await client.localPatients()).find((p) => p.id === pId)._sync, 'pending');

    // Also queue a care entry offline
    await client.saveCareEntry(docPatient, {
      type: 'diagnostic',
      status: 'planned',
      date: '2026-12-20',
      title: 'Buccal Biopsy Workup',
      facility: 'Area Hospital Paderu',
      notes: 'Offline diagnostic plan'
    });
    assert.equal((await client.localOutbox()).length, 2);

    online = true;
    const docSync = await client.syncRecords();
    assert.equal(docSync.uploaded, 2);
    assert.equal((await client.localOutbox()).length, 0);
    await client.logout();
    cookieJar = '';

    // 3. Specialist queues investigation offline and syncs on reconnect
    await client.login('specialist@drishti.demo', 'Drishti@2026');
    await client.openCache();
    await client.syncRecords();
    online = false;
    await client.createInvestigation({
      patientId: pId,
      patientName: 'Killo Mangamma',
      testType: 'biopsy',
      facility: 'Area Hospital Paderu',
      clinicalFindings: 'Offline punch biopsy order'
    });
    assert.equal((await client.localOutbox()).length, 1);
    assert.equal((await client.getCachedDataset('investigations', [])).length, 1);

    online = true;
    const specSync = await client.syncRecords();
    assert.equal(specSync.uploaded, 1);
    assert.equal((await client.localOutbox()).length, 0);
    await client.logout();
    cookieJar = '';

    // 4. Hospital Coordinator queues navigation & referral status offline and syncs
    await client.login('hospital@drishti.demo', 'Drishti@2026');
    await client.openCache();
    await client.syncRecords();
    const refsRes = await client.listReferrals();
    assert.ok(refsRes.referrals.length >= 1);
    await client.saveCachedDataset('referrals', refsRes.referrals);

    online = false;
    await client.createNavigation({
      patientId: pId,
      patientName: 'Killo Mangamma',
      contactStatus: 'contacted',
      barrierIdentified: '104 Mobile Feeder Vehicle Assigned',
      attendanceConfirmed: true,
      notes: 'Offline transit coordination'
    });
    await client.updateReferral(refsRes.referrals[0].id, 'scheduled', 'Booked at Paderu dental clinic', {
      patientId: pId,
      patientName: 'Killo Mangamma'
    });
    assert.equal((await client.localOutbox()).length, 2);

    online = true;
    const hospSync = await client.syncRecords();
    assert.equal(hospSync.uploaded, 2);
    assert.equal((await client.localOutbox()).length, 0);

    const updatedRefs = (await client.listReferrals()).referrals;
    assert.equal(updatedRefs[0].status, 'scheduled');
  } finally {
    globalThis.fetch = origFetch;
    if (origNavDesc) Object.defineProperty(globalThis, 'navigator', origNavDesc);
    server.close();
    await rm(dir, { recursive: true, force: true });
  }
});
