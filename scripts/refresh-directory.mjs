// Refreshes data/sweetgreen-nyc-locations.json from Sweetgreen's public locations page, then reads each location's
// own page for its map position and phone number (about 40 requests, a short pause between each).
// Run: npm run data:directory
import { readFile, writeFile } from 'node:fs/promises';
import { SWEETGREEN_LOCATIONS_URL } from '../lib/server/config.js';
import { parseDirectory, parseLocationPage } from '../lib/server/directory.js';

const SNAPSHOT = new URL('../data/sweetgreen-nyc-locations.json', import.meta.url);
const headers = { 'user-agent': 'food-safety-followup course project (directory refresh)' };
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function page(url) {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`${url} returned ${response.status}.`);
  return response.text();
}

let listPage;
try {
  listPage = await page(SWEETGREEN_LOCATIONS_URL);
} catch (error) {
  throw new Error(`${error.message} The saved directory was not changed.`);
}
const locations = parseDirectory(listPage);

// A location page that fails keeps the values from the last snapshot instead of losing them.
const previous = await readFile(SNAPSHOT, 'utf8').then((text) => new Map(JSON.parse(text).locations.map((item) => [item.id, item])), () => new Map());
let missing = 0;
for (const location of locations) {
  try {
    Object.assign(location, parseLocationPage(await page(location.sourceUrl)));
  } catch (error) {
    console.warn(`${location.id}: ${error.message}`);
    location.coordinates = previous.get(location.id)?.coordinates ?? null;
    location.phone = previous.get(location.id)?.phone ?? null;
  }
  if (!location.coordinates || !location.phone) missing += 1;
  await pause(400);
}

const snapshot = {
  source: 'Sweetgreen public locations page and each location page. Names, addresses, map positions, and phone numbers only; not inspection or internal safety data.',
  sourceUrl: SWEETGREEN_LOCATIONS_URL,
  fetchedAt: new Date().toISOString(),
  count: locations.length,
  locations,
};
await writeFile(SNAPSHOT, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(`Saved ${locations.length} NYC locations${missing ? `; ${missing} are missing a map position or phone number` : ''}.`);
