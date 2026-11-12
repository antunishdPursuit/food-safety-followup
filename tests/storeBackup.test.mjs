import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { backupDb, listBackups, readDb, restoreDb, updateDb } from '../lib/server/store.js';

const tempDir = () => fs.mkdtemp(path.join(os.tmpdir(), 'fsf-backup-'));
const mark = (value) => (db) => { db.directory.sourceUrl = value; };

test('the first write has nothing to back up, and each later write keeps the version it replaces', async () => {
  const dir = await tempDir();
  await updateDb(mark('one'), dir);
  assert.deepEqual(await listBackups(dir), []);
  await updateDb(mark('two'), dir);
  const [name] = await listBackups(dir);
  const saved = JSON.parse(await fs.readFile(path.join(dir, 'backups', name), 'utf8'));
  assert.equal(saved.version, 1);
  assert.equal(saved.directory.sourceUrl, 'one');
  assert.equal((await readDb(dir)).directory.sourceUrl, 'two');
});

test('only the newest 20 backups are kept', async () => {
  const dir = await tempDir();
  for (let index = 1; index <= 25; index += 1) await updateDb(mark(`write ${index}`), dir);
  const names = await listBackups(dir);
  assert.equal(names.length, 20);
  const versions = await Promise.all(names.map(async (name) => JSON.parse(await fs.readFile(path.join(dir, 'backups', name), 'utf8')).version));
  assert.equal(Math.max(...versions), 24);
  assert.equal(Math.min(...versions), 5);
});

test('a change that throws writes no backup and leaves the store alone', async () => {
  const dir = await tempDir();
  await updateDb(mark('kept'), dir);
  await assert.rejects(updateDb(() => { throw new Error('rejected'); }, dir), /rejected/);
  assert.deepEqual(await listBackups(dir), []);
  assert.equal((await readDb(dir)).directory.sourceUrl, 'kept');
});

test('a backup that cannot be written is reported but never blocks the save', async () => {
  const dir = await tempDir();
  await updateDb(mark('one'), dir);
  await fs.writeFile(path.join(dir, 'backups'), 'a file where the backup folder should be');
  const warnings = [];
  const original = console.warn;
  console.warn = (message) => warnings.push(message);
  try {
    await updateDb(mark('two'), dir);
  } finally {
    console.warn = original;
  }
  assert.equal((await readDb(dir)).directory.sourceUrl, 'two');
  assert.match(warnings[0], /backup failed/);
});

test('restoring a backup brings its data back and backs up the store it replaces', async () => {
  const dir = await tempDir();
  await updateDb(mark('good'), dir);
  await updateDb(mark('bad'), dir);
  const [newest] = await listBackups(dir);
  await restoreDb(path.join(dir, 'backups', newest), dir);
  assert.equal((await readDb(dir)).directory.sourceUrl, 'good');
  const kept = await Promise.all((await listBackups(dir)).map(async (name) => JSON.parse(await fs.readFile(path.join(dir, 'backups', name), 'utf8')).directory.sourceUrl));
  assert.ok(kept.includes('bad'), 'the store that was replaced is itself backed up');
});

test('restore refuses a missing file, invalid JSON, and a file that is not a store', async () => {
  const dir = await tempDir();
  await updateDb(mark('keep'), dir);
  const bad = path.join(dir, 'not-json.txt');
  await fs.writeFile(bad, '{ nope');
  const wrong = path.join(dir, 'wrong.json');
  await fs.writeFile(wrong, JSON.stringify({ hello: 'world' }));
  await assert.rejects(restoreDb(path.join(dir, 'missing.json'), dir), /No file/);
  await assert.rejects(restoreDb(bad, dir), /not valid JSON/);
  await assert.rejects(restoreDb(wrong, dir), /does not look like a data store/);
  assert.equal((await readDb(dir)).directory.sourceUrl, 'keep');
});

test('backupDb returns null when there is no store yet', async () => {
  assert.equal(await backupDb(await tempDir()), null);
});
