import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { seedSample } from '../lib/server/sample.js';

async function route() {
  process.env.FSF_DATA_DIR = await fs.mkdtemp(path.join(os.tmpdir(), 'fsf-route-'));
  await seedSample({ dir: process.env.FSF_DATA_DIR });
  const { POST } = await import('../app/api/import/route.js');
  return async (headers = {}) => {
    const response = await POST(new Request('http://x/api/import', { method: 'POST', headers }));
    return { status: response.status, body: await response.json() };
  };
}

test('refreshing from the web is off unless an import key is configured', async () => {
  delete process.env.FSF_IMPORT_KEY;
  const post = await route();
  const { status, body } = await post({ 'x-import-key': 'anything' });
  assert.equal(status, 403);
  assert.equal(body.error.code, 'import_disabled');
});

test('a missing or wrong key is refused, and the right key runs the refresh', async () => {
  // The sample store has no verified location, so the refresh reports that instead of claiming success.
  process.env.FSF_IMPORT_KEY = 'correct-key';
  const post = await route();
  assert.equal((await post()).status, 401);
  assert.equal((await post({ 'x-import-key': 'wrong' })).status, 401);
  const ok = await post({ 'x-import-key': 'correct-key' });
  assert.equal(ok.status, 409);
  assert.deepEqual(ok.body, { ok: false, skipped: true, error: 'No location is verified yet. Run npm run data:match first.' });
  delete process.env.FSF_IMPORT_KEY;
});
