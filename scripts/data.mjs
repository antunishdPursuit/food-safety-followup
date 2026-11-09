// Command-line steps for the city data. Run through the npm scripts:
//   npm run data:sync      bring the saved Sweetgreen directory into the store
//   npm run data:match     match each location to its NYC CAMIS permit by address
//   npm run data:confirm -- <locationId> <camis>   choose one of a location's candidate permits
//   npm run data:import    refresh inspection records for verified locations
//   npm run data:status    show coverage, freshness, and candidates needing a decision
import { readFile } from 'node:fs/promises';
import { dataDir } from '../lib/server/config.js';
import { confirmMatch, matchLocationsToCity, refreshInspections, syncDirectory } from '../lib/server/importer.js';
import { createNycClient } from '../lib/server/nyc.js';
import { summarizeStore } from '../lib/server/status.js';
import { readDb } from '../lib/server/store.js';

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
  for (const location of locations.filter((item) => item.matchStatus === 'candidate')) {
    console.log(`\n${location.id} (${location.address}) needs a decision:`);
    for (const candidate of location.candidates) console.log(`  CAMIS ${candidate.camis}  ${candidate.dba}  ${candidate.address}  - ${candidate.reason}`);
    console.log(`  npm run data:confirm -- ${location.id} <camis>`);
  }
}

const steps = {
  sync: async () => {
    const snapshot = JSON.parse(await readFile(new URL('../data/sweetgreen-nyc-locations.json', import.meta.url), 'utf8'));
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
