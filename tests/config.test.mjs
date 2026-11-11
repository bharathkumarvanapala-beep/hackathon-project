import test from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig, parseInteger, parseBoolean } from '../src/config.mjs';

test('loadConfig provides sensible, safe defaults', () => {
  const config = loadConfig({}, {});
  assert.equal(config.server.host, '127.0.0.1');
  assert.equal(config.server.port, 4173);
  assert.equal(config.server.lanHost, '');
  assert.equal(config.server.cookieSecure, false);
  assert.equal(config.server.trustCloudflare, false);
  assert.equal(config.voice.enabled, false);
  assert.equal(config.voice.dailyLimit, 5);
  assert.equal(config.ai.timeoutMs, 25000);
  assert.ok(config.paths.dataDir.endsWith('.local'));
  assert.ok(config.paths.imagesDir.includes('images'));
});

test('loadConfig honors explicit overrides', () => {
  const config = loadConfig({
    port: 0,
    cookieSecure: true,
    voiceDailyLimit: 20,
    lanHost: '192.168.1.50',
    lanPort: 8081,
  });
  assert.equal(config.server.port, 0);
  assert.equal(config.server.cookieSecure, true);
  assert.equal(config.voice.dailyLimit, 20);
  assert.equal(config.server.lanHost, '192.168.1.50');
  assert.equal(config.server.lanPort, 8081);
});

test('loadConfig validates invalid port and lanHost values', () => {
  assert.throws(() => loadConfig({ port: 99999 }), RangeError);
  assert.throws(() => loadConfig({ port: -1 }), RangeError);
  assert.throws(() => loadConfig({ lanHost: '8.8.8.8' }), TypeError); // Not a private IPv4
  assert.throws(() => loadConfig({ lanHost: 'invalid-ip' }), TypeError);
});

test('parseBoolean correctly parses string values', () => {
  assert.equal(parseBoolean('true'), true);
  assert.equal(parseBoolean('1'), true);
  assert.equal(parseBoolean('yes'), true);
  assert.equal(parseBoolean('TRUE'), true);
  assert.equal(parseBoolean('false'), false);
  assert.equal(parseBoolean('0'), false);
  assert.equal(parseBoolean(''), false);
  assert.equal(parseBoolean(undefined, true), true);
});

test('parseInteger rejects non-integer or out-of-range values', () => {
  assert.equal(parseInteger('42', 10, 1, 100, 'Test'), 42);
  assert.equal(parseInteger(undefined, 10, 1, 100, 'Test'), 10);
  assert.throws(() => parseInteger('abc', 10, 1, 100, 'Test'), RangeError);
  assert.throws(() => parseInteger('0', 10, 1, 100, 'Test'), RangeError);
});
