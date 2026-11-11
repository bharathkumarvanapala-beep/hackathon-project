import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer } from '../src/server.mjs';

test('health endpoint returns operational status and diagnostic metadata', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'drishti-health-'));
  const server = await startServer({ port: 0, dataDir: directory });
  const base = `http://127.0.0.1:${server.address().port}`;

  try {
    const res = await fetch(`${base}/api/health`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.mode, 'shared-demo');
    assert.ok(typeof body.instanceId === 'string' && body.instanceId.length > 0);
    assert.ok(typeof body.timestamp === 'string');
    assert.equal(body.version, '0.3.0');

    // System diagnostics
    assert.ok(body.system);
    assert.ok(body.system.node.startsWith('v'));
    assert.ok(body.system.platform);

    // Database diagnostics
    assert.ok(body.database);
    assert.equal(body.database.status, 'connected');
    assert.equal(body.database.journalMode, 'WAL');

    // AI diagnostics
    assert.ok(body.ai);
    assert.equal(body.ai.configuredModel, 'Al04ni/Umlomo');
    assert.equal(body.ai.candidateModel, 'prithivMLmods/tooth-agenesis-siglip2');
    assert.ok(typeof body.ai.timeoutMs === 'number');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
