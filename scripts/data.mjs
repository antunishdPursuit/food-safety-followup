// Command-line steps for the city data. Run through the npm scripts:
//   npm run data:sync      bring the location list (built from the city permit list) into the store
//   npm run data:match     match each location to its NYC CAMIS permit by address
//   npm run data:confirm -- <locationId> <camis>   choose one of a location's candidate permits
//   npm run data:import    refresh inspection records for verified locations
//   npm run data:status    show coverage, freshness, and candidates needing a decision
//   npm run data:backup    copy the store to backups/ now (every write also keeps the last 20 copies)
//   npm run data:restore -- <file>   put a backup back; with no file, list the backups, newest first
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { dataDir } from '../lib/server/config.js';
import { confirmMatch, matchLocationsToCity, refreshInspections, syncDirectory } from '../lib/server/importer.js';
import { directoryFromPermits } from '../lib/server/permits.js';
import { createNycClient } from '../lib/server/nyc.js';
import { summarizeStore } from '../lib/server/status.js';
import { backupDb, listBackups, readDb, restoreDb } from '../lib/server/store.js';

// Read .env when this Node version can (20.12 or newer); otherwise use the shell's environment.
try { process.loadEnvFile?.(); } catch { /* no .env file */ }

const [command, ...args] = process.argv.slice(2);
const dir = dataDir();

async function status() {
  const db = await readDb(dir);
  const locations = Object.values(db.locations).filter((location) => !location.delisted);
  const summary = summarizeStore(db);
  console.log(`Status as of ${summary.checkedAt} (store: ${dir})`);
  console.log(`Locations: ${summary.locations} (verified ${summary.verified}: ${summary.verifiedAutomatically} automatically, ${summary.confirmedByManager} confirmed by the manager; candidate ${summary.candidates}; unverified ${summary.unverified})`);
  console.log(`Stored records: ${summary.inspections} inspections and ${summary.citations} citations${summary.historyCitations ? `, plus ${summary.historyCitations} citations kept as history from a previous permit` : ''}`);
  console.log(`Last successful import: ${summary.lastSuccess || 'never'}`);
  if (summary.error) console.log(`Last import error (${summary.lastAttempt}): ${summary.error}`);
  if (summary.warning) console.log(`Last import warning: ${summary.warning}`);
  for (const location of locations.filter((item) => item.matchStatus === 'candidate')) {
    console.log(`\n${location.id} (${location.address}) needs a decision:`);
    for (const candidate of location.candidates) console.log(`  CAMIS ${candidate.camis}  ${candidate.dba}  ${candidate.address}  - ${candidate.reason}`);
    console.log(`  npm run data:confirm -- ${location.id} <camis>`);
  }
}

const steps = {
  sync: async () => {
    const read = async (name) => JSON.parse(await readFile(new URL(`../data/${name}`, import.meta.url), 'utf8'));
    const snapshot = directoryFromPermits({ confirmed: await read('confirmed-matches.json'), permits: await read('permit-directory.json') });
    console.log(await syncDirectory({ snapshot, dir }));
  },
  match: async () => console.log(await matchLocationsToCity({ client: createNycClient(), dir })),
  import: async () => {
    const result = await refreshInspections({ client: createNycClient(), dir });
    console.log(result);
    if (!result.ok) process.exitCode = 1;
  },
  confirm: async () => {
    const [locationId, camis] = args;
    if (!locationId || !camis) throw new Error('Usage: npm run data:confirm -- <locationId> <camis>');
    const location = await confirmMatch({ locationId, camis, dir });
    console.log(`${location.id} is now verified with CAMIS ${location.camis}. Run npm run data:import to load its inspections.`);
  },
  status,
  backup: async () => {
    const target = await backupDb(dir, { version: (await readDb(dir)).version });
    console.log(target ? `Backed up the store to ${target}. Keep one copy off this computer.` : `There is no store at ${dir} to back up.`);
  },
  restore: async () => {
    const [file] = args;
    if (!file) {
      const names = await listBackups(dir);
      console.log(names.length ? `Backups in ${path.join(dir, 'backups')}, newest first:\n${names.map((name) => `  ${name}`).join('\n')}\nRestore one with: npm run data:restore -- ${path.join(dir, 'backups', '<file>')}` : `No backups yet in ${path.join(dir, 'backups')}.`);
      return;
    }
    await restoreDb(path.resolve(file), dir);
    console.log(`Restored the store from ${file}. The store it replaced was backed up first.`);
  },
};

if (!steps[command]) {
  console.error(`Unknown command "${command || ''}". Use one of: ${Object.keys(steps).join(', ')}.`);
  process.exit(2);
}
try {
  await steps[command]();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
