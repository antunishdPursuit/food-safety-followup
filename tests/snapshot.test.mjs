import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApiClient } from '../lib/api.js';
import { restoreConfirmedMatches } from '../lib/server/matches.js';
import { syncDirectory } from '../lib/server/importer.js';
import { seedSample } from '../lib/server/sample.js';
import { readDb } from '../lib/server/store.js';
import { writeSnapshot } from '../lib/server/snapshot.js';

const dataFile = async (name) => JSON.parse(await fs.readFile(new URL(`../data/${name}`, import.meta.url), 'utf8'));
const tempDir = (label) => fs.mkdtemp(path.join(os.tmpdir(), `fsf-${label}-`));

test('the confirmed matches name 38 distinct locations and 38 distinct city permits that exist', async () => {
  const confirmed = await dataFile('confirmed-matches.json');
  const permits = await dataFile('permit-directory.json');
  const directory = await dataFile('sweetgreen-nyc-locations.json');
  assert.equal(confirmed.count, confirmed.matches.length);
  assert.equal(confirmed.matches.length, 38);
  assert.equal(new Set(confirmed.matches.map((match) => match.id)).size, 38);
  assert.equal(new Set(confirmed.matches.map((match) => match.camis)).size, 38);
  const listed = new Set(directory.locations.map((location) => location.id));
  const known = new Set(permits.permits.map((permit) => permit.camis));
  for (const match of confirmed.matches) {
    assert.ok(listed.has(match.id), `${match.id} is in the saved directory`);
    assert.ok(known.has(match.camis), `${match.camis} is in the city permit list`);
  }
  assert.equal(confirmed.matches.filter((match) => match.confirmedByManager).length, 9);
});

test('restoring the confirmed matches into a fresh store verifies all 38 locations without a network call', async () => {
  const dir = await tempDir('matches');
  const confirmed = await dataFile('confirmed-matches.json');
  const permits = await dataFile('permit-directory.json');
  await syncDirectory({ snapshot: await dataFile('sweetgreen-nyc-locations.json'), dir });
  assert.deepEqual(await restoreConfirmedMatches({ confirmed, permits, dir }), { restored: 38 });
  const locations = Object.values((await readDb(dir)).locations);
  assert.equal(locations.filter((location) => location.matchStatus === 'verified').length, 38);
  assert.equal(locations.filter((location) => location.confirmedByManager).length, 9);
  assert.ok(locations.every((location) => location.candidates.length === 0));
  const bowery = locations.find((location) => location.camis === '50098726');
  assert.ok(Array.isArray(bowery.coordinates), 'the city map position becomes the pin');
});

test('restoring matches fails clearly for an unknown location or a permit that is not in the list', async () => {
  const dir = await tempDir('matches-bad');
  const permits = { permits: [{ camis: '1', coordinates: null }] };
  await assert.rejects(restoreConfirmedMatches({ confirmed: { matches: [{ id: 'nowhere', camis: '1' }] }, permits, dir }), /Unknown location "nowhere"/);
  await syncDirectory({ snapshot: await dataFile('sweetgreen-nyc-locations.json'), dir });
  await assert.rejects(restoreConfirmedMatches({ confirmed: { matches: [{ id: '23rd-park', camis: '999' }] }, permits, dir }), /not in the city permit list/);
});

test('the snapshot writes the list and one file per location, matching what the read endpoints return', async () => {
  const dir = await tempDir('store');
  const outDir = path.join(await tempDir('out'), 'snapshot');
  await seedSample({ dir });
  const result = await writeSnapshot({ dir, outDir });
  assert.equal(result.locations, 3);
  const list = JSON.parse(await fs.readFile(path.join(outDir, 'locations.json'), 'utf8'));
  assert.equal(list.locations.length, 3);
  for (const location of list.locations) {
    const detail = JSON.parse(await fs.readFile(path.join(outDir, 'locations', `${location.id}.json`), 'utf8'));
    assert.equal(detail.locationId, location.id);
    assert.equal(detail.regionalWindow.months, 12);
  }
  await writeSnapshot({ dir, outDir }); // a second build replaces the files instead of adding to them
  assert.equal((await fs.readdir(path.join(outDir, 'locations'))).length, 3);
});

test('in snapshot mode the client reads files under the base path and every save says it is read-only', async () => {
  const previous = { snapshot: process.env.NEXT_PUBLIC_SNAPSHOT, base: process.env.NEXT_PUBLIC_BASE_PATH };
  process.env.NEXT_PUBLIC_SNAPSHOT = '1';
  process.env.NEXT_PUBLIC_BASE_PATH = '/food-safety-followup';
  try {
    const urls = [];
    const client = createApiClient(async (url) => { urls.push(url); return new Response(JSON.stringify({ ok: true }), { status: 200 }); });
    await client.locations();
    await client.location('chambers-st');
    assert.deepEqual(urls, ['/food-safety-followup/snapshot/locations.json', '/food-safety-followup/snapshot/locations/chambers-st.json']);
    assert.deepEqual(await client.session(), { protected: false, protectReads: false, signedIn: false });
    for (const save of [() => client.saveFollowUp({}), () => client.setCheckLink('c', 'linked', 'x'), () => client.signIn('code'), () => client.signOut()]) {
      await assert.rejects(save(), (error) => error.status === 405 && /read-only snapshot/.test(error.message));
    }
    assert.equal(urls.length, 2, 'no save reached the network');
  } finally {
    for (const [key, value] of [['NEXT_PUBLIC_SNAPSHOT', previous.snapshot], ['NEXT_PUBLIC_BASE_PATH', previous.base]]) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

test('the snapshot build is a static export under the base path and leaves the normal build alone', async () => {
  const load = async (env, tag) => {
    const previous = { snapshot: process.env.NEXT_PUBLIC_SNAPSHOT, base: process.env.NEXT_PUBLIC_BASE_PATH };
    if (env) { process.env.NEXT_PUBLIC_SNAPSHOT = '1'; process.env.NEXT_PUBLIC_BASE_PATH = '/food-safety-followup'; } else delete process.env.NEXT_PUBLIC_SNAPSHOT;
    try {
      return (await import(`../next.config.mjs?${tag}`)).default;
    } finally {
      for (const [key, value] of [['NEXT_PUBLIC_SNAPSHOT', previous.snapshot], ['NEXT_PUBLIC_BASE_PATH', previous.base]]) {
        if (value === undefined) delete process.env[key]; else process.env[key] = value;
      }
    }
  };
  const snapshot = await load(true, 'snapshot-config');
  assert.equal(snapshot.output, 'export');
  assert.equal(snapshot.basePath, '/food-safety-followup');
  assert.deepEqual(snapshot.pageExtensions, ['jsx']);
  assert.equal(snapshot.headers, undefined);
  const normal = await load(false, 'normal-config');
  assert.equal(normal.output, undefined);
  assert.equal(typeof normal.headers, 'function');
});
