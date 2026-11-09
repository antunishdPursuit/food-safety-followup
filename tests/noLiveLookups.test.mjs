import test from 'node:test';
import assert from 'node:assert/strict';
import { createNycClient } from '../lib/server/nyc.js';

// These run under `npm test`, which preloads tests/support/no-live-lookups.mjs.
test('tests cannot reach the live city service or the Sweetgreen site', async () => {
  await assert.rejects(fetch('https://data.cityofnewyork.us/resource/43nn-pn8j.json?$limit=1'), /Live lookups are blocked in tests/);
  await assert.rejects(fetch('https://www.sweetgreen.com/locations'), /Live lookups are blocked in tests/);
});

test('the real client, built without a fake, fails instead of calling the city', async () => {
  const client = createNycClient({ attempts: 1 });
  await assert.rejects(client.fetchInspectionRows(['1']), /NYC Open Data request failed\. Live lookups are blocked/);
});
