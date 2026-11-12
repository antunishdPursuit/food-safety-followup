import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { seedSample } from '../lib/server/sample.js';
import { updateDb } from '../lib/server/store.js';

const tempDir = () => fs.mkdtemp(path.join(os.tmpdir(), 'fsf-health-'));
const check = async () => {
  const { GET } = await import('../app/api/health/route.js');
  const response = await GET(new Request('http://x/api/health'));
  return { status: response.status, body: await response.json(), headers: response.headers };
};

test('health reports counts and times only, never cached, when the store is readable', async () => {
  process.env.FSF_DATA_DIR = await tempDir();
  await seedSample({ dir: process.env.FSF_DATA_DIR });
  const { status, body, headers } = await check();
  assert.equal(status, 200);
  assert.equal(headers.get('cache-control'), 'no-store');
  assert.equal(body.status, 'ok');
  assert.equal(body.store, 'readable');
  assert.equal(body.locations, 3);
  assert.deepEqual(Object.keys(body).sort(), ['checkedAt', 'importStale', 'lastImportFailed', 'lastSuccessfulImport', 'locations', 'status', 'store', 'verifiedLocations']);
});

test('health stays 200 but marks the import stale when the city import never ran or is old', async () => {
  process.env.FSF_DATA_DIR = await tempDir();
  assert.equal((await check()).body.importStale, true);
  await updateDb((db) => { db.importStatus.lastSuccess = new Date().toISOString(); }, process.env.FSF_DATA_DIR);
  const fresh = await check();
  assert.equal(fresh.status, 200);
  assert.equal(fresh.body.importStale, false);
  await updateDb((db) => { db.importStatus.lastSuccess = new Date(Date.now() - 200 * 3_600_000).toISOString(); }, process.env.FSF_DATA_DIR);
  assert.equal((await check()).body.importStale, true);
});

test('health returns 503 without leaking details when the store file is unreadable', async () => {
  process.env.FSF_DATA_DIR = await tempDir();
  await fs.writeFile(path.join(process.env.FSF_DATA_DIR, 'db.json'), '{ not json');
  const { status, body } = await check();
  assert.equal(status, 503);
  assert.deepEqual(body, { status: 'unavailable', checkedAt: body.checkedAt, store: 'unreadable' });
});
