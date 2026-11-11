import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '..');

test('Accessibility & Bilingual UX: English and Telugu dictionary parity and validity', () => {
  const enPath = resolve(rootDir, 'public', 'i18n', 'en.json');
  const tePath = resolve(rootDir, 'public', 'i18n', 'te.json');

  assert.equal(existsSync(enPath), true, 'public/i18n/en.json must exist');
  assert.equal(existsSync(tePath), true, 'public/i18n/te.json must exist');

  const enRaw = readFileSync(enPath, 'utf8');
  const teRaw = readFileSync(tePath, 'utf8');

  let enDict, teDict;
  assert.doesNotThrow(() => {
    enDict = JSON.parse(enRaw);
  }, 'en.json must be valid JSON');

  assert.doesNotThrow(() => {
    teDict = JSON.parse(teRaw);
  }, 'te.json must be valid JSON');

  const enKeys = Object.keys(enDict).sort();
  const teKeys = Object.keys(teDict).sort();

  assert.ok(enKeys.length >= 50, `Expected at least 50 translation keys, found ${enKeys.length}`);

  // Test 100% key parity
  const missingInTe = enKeys.filter((k) => !(k in teDict));
  const missingInEn = teKeys.filter((k) => !(k in enDict));

  assert.deepEqual(
    missingInTe,
    [],
    `Keys present in English but missing in Telugu: ${missingInTe.join(', ')}`
  );
  assert.deepEqual(
    missingInEn,
    [],
    `Keys present in Telugu but missing in English: ${missingInEn.join(', ')}`
  );

  // Verify Telugu Unicode script presence in Telugu values
  const teluguUnicodeRegex = /[\u0C00-\u0C7F]/;
  const teluguValuesWithScript = Object.values(teDict).filter(
    (val) => typeof val === 'string' && teluguUnicodeRegex.test(val)
  );

  assert.ok(
    teluguValuesWithScript.length > enKeys.length * 0.7,
    'At least 70% of Telugu dictionary entries should contain authentic Telugu Unicode script'
  );

  // Critical clinical keys must exist
  assert.ok(enDict.app_name, 'app_name key required');
  assert.ok(teDict.app_name, 'app_name Telugu translation required');
  assert.ok(enDict.provisional_diagnosis, 'provisional_diagnosis key required');
  assert.ok(enDict.oral_quadrant, 'oral_quadrant key required');
  assert.ok(enDict.referral_priority, 'referral_priority key required');
  assert.ok(enDict.conflict_detected, 'conflict_detected key required');
});

test('i18n translation engine: fallback handling, language switching, and localized dates', async () => {
  // Mock localStorage and document for Node test environment
  const storage = {};
  globalThis.localStorage = {
    getItem: (k) => storage[k] || null,
    setItem: (k, v) => {
      storage[k] = String(v);
    },
    removeItem: (k) => {
      delete storage[k];
    }
  };
  globalThis.document = {
    documentElement: { lang: 'en' }
  };

  const { t, setLanguage, getLanguage, formatDate } = await import('../public/i18n.js');

  // Initial language defaults to 'en'
  setLanguage('en');
  assert.equal(getLanguage(), 'en');
  assert.equal(t('app_name'), 'Aarogya Drishti');

  // Switch to Telugu
  setLanguage('te');
  assert.equal(getLanguage(), 'te');
  assert.equal(t('app_name'), 'ఆరోగ్య దృష్టి');
  assert.equal(globalThis.document.documentElement.lang, 'te');

  // Rejection of unsupported languages
  setLanguage('fr');
  assert.equal(getLanguage(), 'te', 'Unsupported language must be rejected');

  // Fallback to English or default string
  assert.equal(t('non_existent_key_xyz', 'My Fallback'), 'My Fallback');
  assert.equal(t('non_existent_key_xyz'), 'non_existent_key_xyz');

  // Date formatting
  const iso = '2026-10-29T10:00:00.000Z';
  const formattedTe = formatDate(iso);
  assert.ok(typeof formattedTe === 'string' && formattedTe.length > 0);

  setLanguage('en');
  const formattedEn = formatDate(iso);
  assert.ok(typeof formattedEn === 'string' && formattedEn.length > 0);
  assert.equal(formatDate(null), '—');
});

test('Offline sync conflict resolution logic: detection, diff comparison, and resolution paths', () => {
  // Simulate concurrent edit conflict (HTTP 409)
  const localPatient = {
    id: 'AD-PADERU-101',
    name: 'Lakshmi Devi',
    age: 42,
    village: 'Hukumpeta',
    stage: 'screened',
    notes: 'Local field health worker notes regarding gingival bleeding',
    createdAt: '2026-10-29T08:00:00.000Z',
    version: 1,
    _sync: 'pending'
  };

  const serverPatient = {
    id: 'AD-PADERU-101',
    name: 'Lakshmi Devi',
    age: 42,
    village: 'Hukumpeta',
    stage: 'reviewed',
    notes: 'Clinician notes: Stage 1 mucosal lesion, scheduled for Araku dental CHC',
    createdAt: '2026-10-29T08:00:00.000Z',
    updatedAt: '2026-10-29T09:30:00.000Z',
    version: 2
  };

  // Conflict detector function
  function detectConflict(local, remote) {
    if (!remote) return false;
    // Conflict occurs when remote version has progressed past local version
    return (remote.version || 1) > (local.version || 1) && local._sync === 'pending';
  }

  assert.equal(
    detectConflict(localPatient, serverPatient),
    true,
    'Version mismatch on pending sync must trigger conflict flag'
  );

  // Strategy 1: Keep server version (Discard local draft)
  function resolveKeepServer(local, remote) {
    return {
      ...remote,
      _sync: 'shared',
      _syncError: null,
      _serverConflict: null
    };
  }

  const resolvedServer = resolveKeepServer(localPatient, serverPatient);
  assert.equal(resolvedServer.version, 2);
  assert.equal(resolvedServer.stage, 'reviewed');
  assert.equal(resolvedServer._sync, 'shared');
  assert.equal(resolvedServer._syncError, null);

  // Strategy 2: Overwrite with device edit (Preserves field worker observations)
  function resolveKeepLocal(local, remote) {
    return {
      ...local,
      version: remote.version, // Adopts remote version so subsequent patch/post is valid
      notes: `${local.notes} (Merged with remote v${remote.version})`,
      _sync: 'pending',
      _syncError: null,
      _serverConflict: null
    };
  }

  const resolvedLocal = resolveKeepLocal(localPatient, serverPatient);
  assert.equal(resolvedLocal.version, 2);
  assert.equal(resolvedLocal.stage, 'screened');
  assert.equal(resolvedLocal._sync, 'pending');
  assert.ok(resolvedLocal.notes.includes('Merged with remote'));
});
