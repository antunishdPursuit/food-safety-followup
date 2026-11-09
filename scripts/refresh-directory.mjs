// Refreshes data/sweetgreen-nyc-locations.json from Sweetgreen's public locations page.
// Run: npm run data:directory
import { writeFile } from 'node:fs/promises';
import { SWEETGREEN_LOCATIONS_URL } from '../lib/server/config.js';
import { parseDirectory } from '../lib/server/directory.js';

const response = await fetch(SWEETGREEN_LOCATIONS_URL, {
  headers: { 'user-agent': 'food-safety-followup course project (directory refresh)' },
  signal: AbortSignal.timeout(30000),
});
if (!response.ok) throw new Error(`Sweetgreen locations page returned ${response.status}. The saved directory was not changed.`);

const locations = parseDirectory(await response.text());
const snapshot = {
  source: 'Sweetgreen public locations page. Names and addresses only; not inspection or internal safety data.',
  sourceUrl: SWEETGREEN_LOCATIONS_URL,
  fetchedAt: new Date().toISOString(),
  count: locations.length,
  locations,
};
await writeFile(new URL('../data/sweetgreen-nyc-locations.json', import.meta.url), `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(`Saved ${locations.length} NYC locations.`);
