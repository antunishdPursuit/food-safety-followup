import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resetManagerState } from '../lib/server/demo.js';
import { readDb, updateDb } from '../lib/server/store.js';

const root = fileURLToPath(new URL('..', import.meta.url));

async function rehearsedStore() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'fsf-reset-'));
  await updateDb((db) => {
    db.locations.a = { id: 'a', name: 'A', matchStatus: 'verified', camis: '1' };
    db.inspections.a = [{ id: 'i1', date: '2026-07-29', citations: [{ id: 'c1', code: '04N' }] }];
    db.internalChecks.k1 = { id: 'k1', locationId: 'a', type: 'Audit', source: 'Fictional demo check' };
    db.followUps.f1 = { id: 'f1', locationId: 'a', citationId: 'c1', status: 'Open' };
    db.followUps.f2 = { id: 'f2', locationId: 'a', checkId: 'k1', status: 'Complete' };
    db.links.k1 = { checkId: 'k1', locationId: 'a', decision: 'linked', citationId: 'c1' };
  }, dir);
  return dir;
}

test('the reset clears only follow-ups and link decisions, and saves a copy first', async () => {
  const dir = await rehearsedStore();
  const before = await readDb(dir);
  const result = await resetManagerState({ dir, now: new Date('2026-11-09T18:30:15.123Z') });
  assert.deepEqual([result.followUps, result.decisions], [2, 1]);
  assert.match(path.basename(result.backup), /^db-2026-11-09T18-30-15-123Z\.json$/, 'no colons in the file name');
  const after = await readDb(dir);
  assert.deepEqual([after.followUps, after.links], [{}, {}]);
  assert.deepEqual([after.locations, after.inspections, after.internalChecks], [before.locations, before.inspections, before.internalChecks]);
  const saved = JSON.parse(await fs.readFile(result.backup, 'utf8'));
  assert.deepEqual(Object.keys(saved.followUps), ['f1', 'f2'], 'the copy still holds what was removed');
});

test('with nothing to remove it saves no backup and changes nothing', async () => {
  const dir = await rehearsedStore();
  await resetManagerState({ dir });
  const second = await resetManagerState({ dir });
  assert.deepEqual(second, { followUps: 0, decisions: 0, backup: null });
});

test('the command refuses to delete anything without --yes', async () => {
  const dir = await rehearsedStore();
  const env = { ...process.env, FSF_DATA_DIR: dir };
  const refused = spawnSync(process.execPath, ['scripts/demo-reset.mjs'], { cwd: root, env, encoding: 'utf8' });
  assert.equal(refused.status, 1);
  assert.match(refused.stdout, /This would remove 2 follow-ups and 1 link decisions/);
  assert.equal(Object.keys((await readDb(dir)).followUps).length, 2, 'nothing was deleted');
  const done = spawnSync(process.execPath, ['scripts/demo-reset.mjs', '--yes'], { cwd: root, env, encoding: 'utf8' });
  assert.equal(done.status, 0);
  assert.match(done.stdout, /Removed 2 follow-ups and 1 link decisions\. Backup: /);
  assert.deepEqual((await readDb(dir)).followUps, {});
});
