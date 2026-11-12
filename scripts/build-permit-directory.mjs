// Builds data/permit-directory.json from NYC Open Data alone: every permit whose name contains SWEETGREEN.
// This replaces the Sweetgreen website snapshot, which is being retired. Run: npm run data:permits
import { writeFile } from 'node:fs/promises';
import { createNycClient } from '../lib/server/nyc.js';
import { permitDirectory } from '../lib/server/permits.js';

// Read .env when this Node version can (20.12 or newer); otherwise use the shell's environment.
try { process.loadEnvFile?.(); } catch { /* no .env file */ }

const FILE = new URL('../data/permit-directory.json', import.meta.url);

let establishments;
try {
  establishments = await createNycClient().findSweetgreenEstablishments();
} catch (error) {
  throw new Error(`${error.message} The saved permit list was not changed.`);
}
if (establishments.length === 0) throw new Error('NYC Open Data returned no Sweetgreen permits. The saved permit list was not changed.');

const directory = permitDirectory(establishments);
await writeFile(FILE, `${JSON.stringify(directory, null, 2)}\n`);
const noPosition = directory.permits.filter((permit) => !permit.coordinates).length;
console.log(`Saved ${directory.count} Sweetgreen-named permits${noPosition ? `; ${noPosition} have no usable map position in the city record` : ''}.`);
