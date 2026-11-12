import { promises as fs } from 'node:fs';
import path from 'node:path';
import { dataDir } from './config.js';

const LOCK_WAIT_MS = 5000;
const LOCK_STALE_MS = 30000;
const BACKUP_KEEP = 20;

export function emptyDb() {
  return {
    version: 0,
    mode: 'live',
    directory: { fetchedAt: null, sourceUrl: null },
    locations: {},
    inspections: {},
    internalChecks: {},
    followUps: {},
    links: {},
    importStatus: { lastSuccess: null, lastAttempt: null, error: null },
  };
}

function filePath(dir) {
  return path.join(dir, 'db.json');
}

export async function readDb(dir = dataDir()) {
  try {
    return { ...emptyDb(), ...JSON.parse(await fs.readFile(filePath(dir), 'utf8')) };
  } catch (error) {
    if (error.code === 'ENOENT') return emptyDb();
    throw error;
  }
}

async function acquireLock(lockPath) {
  const deadline = Date.now() + LOCK_WAIT_MS;
  for (;;) {
    try {
      return await fs.open(lockPath, 'wx');
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      const age = await fs.stat(lockPath).then((stat) => Date.now() - stat.mtimeMs, () => 0);
      if (age > LOCK_STALE_MS) await fs.rm(lockPath, { force: true });
      else if (Date.now() > deadline) throw new Error('The data store is busy. Try again.');
      else await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }
}

function backupDir(dir) {
  return path.join(dir, 'backups');
}

const BACKUP_NAME = /^db-\d{8}T\d{9}Z-v\d{8}\.json$/;

// Copies the current store aside, named by time and version (so names sort oldest to newest), and keeps only the
// newest BACKUP_KEEP copies. Returns the new file's path, or null when there is no store yet.
export async function backupDb(dir = dataDir(), { now = new Date(), version = 0 } = {}) {
  if (!await fs.access(filePath(dir)).then(() => true, () => false)) return null;
  const stamp = now.toISOString().replace(/[-:.]/g, '');
  const target = path.join(backupDir(dir), `db-${stamp}-v${String(version).padStart(8, '0')}.json`);
  await fs.mkdir(backupDir(dir), { recursive: true });
  await fs.copyFile(filePath(dir), target);
  const names = (await fs.readdir(backupDir(dir))).filter((name) => BACKUP_NAME.test(name)).sort();
  for (const name of names.slice(0, Math.max(0, names.length - BACKUP_KEEP))) await fs.rm(path.join(backupDir(dir), name), { force: true });
  return target;
}

// Backup file names, newest first.
export async function listBackups(dir = dataDir()) {
  const names = await fs.readdir(backupDir(dir)).catch(() => []);
  return names.filter((name) => BACKUP_NAME.test(name)).sort().reverse();
}

// Read, change, and write the store while holding a lock, so two writers (a request and an import)
// cannot overwrite each other. If `change` throws, nothing is written. Just before the store is replaced, the
// version it replaces is copied to backups/ (a failed backup is reported but never blocks the save).
export async function updateDb(change, dir = dataDir()) {
  await fs.mkdir(dir, { recursive: true });
  const lockPath = `${filePath(dir)}.lock`;
  const lock = await acquireLock(lockPath);
  try {
    const db = await readDb(dir);
    const result = await change(db);
    const replacedVersion = db.version;
    db.version += 1;
    const temp = `${filePath(dir)}.${process.pid}.tmp`;
    await fs.writeFile(temp, JSON.stringify(db));
    await backupDb(dir, { version: replacedVersion }).catch((error) => console.warn(`The store backup failed; saving anyway. ${error.message}`));
    await fs.rename(temp, filePath(dir));
    return result;
  } finally {
    await lock.close();
    await fs.rm(lockPath, { force: true });
  }
}

// Puts a backup file back as the store. The store it replaces is backed up first, like any other change.
export async function restoreDb(file, dir = dataDir()) {
  let restored;
  try {
    restored = JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (error) {
    throw new Error(error.code === 'ENOENT' ? `No file at ${file}.` : 'That file is not valid JSON, so nothing was restored.');
  }
  if (!restored || typeof restored !== 'object' || Array.isArray(restored) || !Number.isInteger(restored.version) || !restored.locations || typeof restored.locations !== 'object') {
    throw new Error('That file does not look like a data store, so nothing was restored.');
  }
  await updateDb((db) => {
    for (const key of Object.keys(db)) delete db[key];
    Object.assign(db, emptyDb(), restored);
  }, dir);
}
