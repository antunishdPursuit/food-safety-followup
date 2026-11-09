import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readDb, updateDb } from '../lib/server/store.js';

async function tempDir() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'fsf-store-'));
}

test('a missing store reads as empty instead of failing', async () => {
  const db = await readDb(path.join(await tempDir(), 'nothing-here'));
  assert.equal(db.version, 0);
  assert.deepEqual(db.locations, {});
});

test('changes are saved and survive a fresh read', async () => {
  const dir = await tempDir();
  await updateDb((db) => { db.followUps.a = { owner: 'Manager' }; }, dir);
  const db = await readDb(dir);
  assert.equal(db.followUps.a.owner, 'Manager');
  assert.equal(db.version, 1);
});

test('simultaneous writers never lose an update', async () => {
  const dir = await tempDir();
  await Promise.all(Array.from({ length: 25 }, (_, index) =>
    updateDb((db) => { db.followUps[`f${index}`] = { index }; }, dir)));
  const db = await readDb(dir);
  assert.equal(Object.keys(db.followUps).length, 25);
  assert.equal(db.version, 25);
});

test('a failed change writes nothing and releases the lock', async () => {
  const dir = await tempDir();
  await updateDb((db) => { db.followUps.keep = {}; }, dir);
  await assert.rejects(updateDb((db) => { db.followUps.lost = {}; throw new Error('boom'); }, dir), /boom/);
  const db = await readDb(dir);
  assert.deepEqual(Object.keys(db.followUps), ['keep']);
  await updateDb((next) => { next.followUps.after = {}; }, dir);
  assert.equal((await readDb(dir)).followUps.after !== undefined, true);
});

test('a lock left behind by a crashed process is cleared after it goes stale', async () => {
  const dir = await tempDir();
  const lockPath = path.join(dir, 'db.json.lock');
  await fs.writeFile(lockPath, '');
  const old = new Date(Date.now() - 60000);
  await fs.utimes(lockPath, old, old);
  await updateDb((db) => { db.followUps.x = {}; }, dir);
  assert.ok((await readDb(dir)).followUps.x);
});
