import { promises as fs } from 'node:fs';
import path from 'node:path';
import { dataDir } from './config.js';

const LOCK_WAIT_MS = 5000;
const LOCK_STALE_MS = 30000;

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

// Read, change, and write the store while holding a lock, so two writers (a request and an import)
// cannot overwrite each other. If `change` throws, nothing is written.
export async function updateDb(change, dir = dataDir()) {
  await fs.mkdir(dir, { recursive: true });
  const lockPath = `${filePath(dir)}.lock`;
  const lock = await acquireLock(lockPath);
  try {
    const db = await readDb(dir);
    const result = await change(db);
    db.version += 1;
    const temp = `${filePath(dir)}.${process.pid}.tmp`;
    await fs.writeFile(temp, JSON.stringify(db));
    await fs.rename(temp, filePath(dir));
    return result;
  } finally {
    await lock.close();
    await fs.rm(lockPath, { force: true });
  }
}
