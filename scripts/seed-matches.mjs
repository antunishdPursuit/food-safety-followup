// Restores the confirmed location-to-permit matches into the store (after npm run data:sync).
// Run: npm run data:seed-matches   Then: npm run data:import
import { readFile } from 'node:fs/promises';
import { dataDir } from '../lib/server/config.js';
import { restoreConfirmedMatches } from '../lib/server/matches.js';

// Read .env when this Node version can (20.12 or newer); otherwise use the shell's environment.
try { process.loadEnvFile?.(); } catch { /* no .env file */ }

const read = async (name) => JSON.parse(await readFile(new URL(`../data/${name}`, import.meta.url), 'utf8'));

try {
  const result = await restoreConfirmedMatches({ confirmed: await read('confirmed-matches.json'), permits: await read('permit-directory.json'), dir: dataDir() });
  console.log(`Restored ${result.restored} confirmed matches. Run npm run data:import to load their inspections.`);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
