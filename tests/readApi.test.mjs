import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { matchLocationsToCity, refreshInspections, syncDirectory } from '../lib/server/importer.js';
import { seedSample } from '../lib/server/sample.js';
import { getLocationDetail, listLocations } from '../lib/server/service.js';
import { updateDb } from '../lib/server/store.js';

const tempDir = () => fs.mkdtemp(path.join(os.tmpdir(), 'fsf-read-'));
const call = async (handler, ...args) => { const response = await handler(...args); return { status: response.status, body: await response.json(), headers: response.headers }; };

async function sampleRoutes() {
  process.env.FSF_DATA_DIR = await tempDir();
  await seedSample({ dir: process.env.FSF_DATA_DIR });
  const list = await import('../app/api/locations/route.js');
  const detail = await import('../app/api/locations/[id]/route.js');
  return { list: list.GET, detail: detail.GET };
}

test('GET /api/locations returns one list for pins and rows, with counts and honest empty states', async () => {
  const { list } = await sampleRoutes();
  const { status, body, headers } = await call(list, new Request('http://x/api/locations'));
  assert.equal(status, 200);
  assert.equal(headers.get('cache-control'), 'no-store');
  assert.equal(body.locations.length, 3);
  const byId = Object.fromEntries(body.locations.map((location) => [location.id, location]));
  assert.equal(byId['sample-midtown'].citationCount, 3);
  assert.equal(byId['sample-midtown'].openFollowUpCount, 1);
  assert.equal(byId['sample-midtown'].overdueFollowUpCount, 1);
  assert.equal(byId['sample-downtown'].citationCount, 0);
  assert.equal(byId['sample-queens'].citationCount, null);
  assert.equal(byId['sample-queens'].coordinates, null);
  assert.ok(body.locations.every((location) => location.isSample && location.matchStatus === 'unverified'));
  assert.equal(body.importStatus.state, 'not-connected');
  assert.equal(body.importStatus.coverage, '0 of 3 sample locations verified');
});

test('GET /api/locations/:id returns records, flags, and decisions, newest inspection first', async () => {
  const { detail } = await sampleRoutes();
  const { status, body } = await call(detail, new Request('http://x'), { params: Promise.resolve({ id: 'sample-midtown' }) });
  assert.equal(status, 200);
  assert.equal(body.locationId, 'sample-midtown');
  assert.deepEqual(body.inspections.map((inspection) => inspection.id), ['inspection-2', 'inspection-1']);
  assert.ok(body.flags.some((flag) => flag.id === 'repeat-06D' && flag.type === 'Repeat code'));
  assert.ok(body.flags.some((flag) => flag.id === 'unlinked-citation-1'));
  assert.ok(!body.flags.some((flag) => flag.id === 'unlinked-citation-2'), 'citation-2 already has a follow-up');
  const check = body.internalChecks.find((item) => item.id === 'check-1');
  assert.equal(check.source, 'Fictional demo check');
  assert.equal(check.suggestedCitationId, 'citation-1');
  assert.equal(check.link, null);
  assert.equal(body.internalChecks.find((item) => item.id === 'check-2').suggestedCitationId, undefined);
  assert.equal(body.followUps[0].overdue, true);
  assert.deepEqual(body.regionalSignals, []);
});

test('a no-violation inspection and a location with no records stay distinct', async () => {
  const { detail } = await sampleRoutes();
  const downtown = (await call(detail, new Request('http://x'), { params: Promise.resolve({ id: 'sample-downtown' }) })).body;
  assert.equal(downtown.inspections[0].outcome, 'no-violations');
  assert.equal(downtown.flags.length, 0);
  const queens = (await call(detail, new Request('http://x'), { params: Promise.resolve({ id: 'sample-queens' }) })).body;
  assert.deepEqual(queens.inspections, []);
  assert.equal(queens.location.citationCount, null);
});

test('an unknown location id returns a structured 404', async () => {
  const { detail } = await sampleRoutes();
  for (const id of ['nope', '__proto__', 'constructor']) {
    const { status, body } = await call(detail, new Request('http://x'), { params: Promise.resolve({ id }) });
    assert.equal(status, 404, id);
    assert.equal(body.error.code, 'location_not_found');
  }
});

const snapshot = {
  fetchedAt: '2026-11-09T12:00:00.000Z', sourceUrl: 'https://www.sweetgreen.com/locations',
  locations: ['union-square', 'dumbo', 'nolita', 'bowery'].map((id, index) => ({
    id, name: `Sweetgreen ${id}`, street: ['870 Broadway', '50 Washington St', '100 Kenmare St', '347 Bowery Ave'][index],
    zip: ['10003', '11201', '10012', '10003'][index], address: `${id} address`, sourceUrl: `https://www.sweetgreen.com/locations/${id}`,
  })),
};
const establishments = [
  { camis: '1', dba: 'SWEETGREEN', building: '870', street: 'BROADWAY', zipcode: '10003', latitude: '40.7339', longitude: '-73.9904' },
  { camis: '2', dba: 'SWEETGREEN', building: '50', street: 'WASHINGTON STREET', zipcode: '11201', latitude: '40.70', longitude: '-73.99' },
  { camis: '4', dba: 'SWEETGREEN', building: '347', street: 'BOWERY', zipcode: '10003', latitude: '40.72', longitude: '-73.99' },
];
const rows = [
  { camis: '1', inspection_date: '2026-09-18T00:00:00.000', inspection_type: 'Cycle', violation_code: '06D', violation_description: 'Surface', critical_flag: 'Critical' },
  { camis: '1', inspection_date: '2026-10-08T00:00:00.000', inspection_type: 'Re-inspection', violation_code: '06D', violation_description: 'Surface', critical_flag: 'Critical' },
];
const client = (fetchRows = async () => rows) => ({ findSweetgreenEstablishments: async () => establishments, findEstablishmentsAtAddress: async () => [], fetchInspectionRows: fetchRows });

async function liveStore(fetchRows) {
  const dir = await tempDir();
  await syncDirectory({ snapshot, dir });
  await matchLocationsToCity({ client: client(), dir });
  await refreshInspections({ client: client(fetchRows), dir, now: new Date('2026-11-09T13:00:00Z') });
  return dir;
}

test('live store: verified, candidate, unverified, and empty-but-verified locations are all distinguishable', async () => {
  const dir = await liveStore();
  const { locations, importStatus } = await listLocations({ dir, now: new Date('2026-11-10T00:00:00Z') });
  const byId = Object.fromEntries(locations.map((location) => [location.id, location]));
  assert.equal(byId['union-square'].dataState, 'records');
  assert.equal(byId['union-square'].citationCount, 2);
  assert.deepEqual(byId['union-square'].coordinates, [40.7339, -73.9904]);
  assert.equal(byId['union-square'].flagCount, 3);
  assert.equal(byId.dumbo.dataState, 'no-records');
  assert.equal(byId.dumbo.citationCount, null, 'a verified location with no records is not reported as zero citations');
  assert.equal(byId.nolita.matchStatus, 'unverified');
  assert.equal(byId.nolita.dataState, 'unmatched');
  assert.equal(byId.bowery.matchStatus, 'candidate');
  assert.equal(byId.bowery.candidateCount, 1);
  assert.equal(importStatus.coverage, '2 of 4 locations verified');
  assert.equal(importStatus.state, 'ok');
});

test('live store: import freshness is reported as never-run, ok, stale, or failed', async () => {
  const empty = await tempDir();
  await syncDirectory({ snapshot, dir: empty });
  assert.equal((await listLocations({ dir: empty })).importStatus.state, 'never-run');

  const dir = await liveStore();
  assert.equal((await listLocations({ dir, now: new Date('2026-11-09T14:00:00Z') })).importStatus.state, 'ok');
  assert.equal((await listLocations({ dir, now: new Date('2026-11-20T00:00:00Z') })).importStatus.state, 'stale');

  await refreshInspections({ client: client(async () => { throw new Error('NYC Open Data request failed. timeout'); }), dir, now: new Date('2026-11-21T00:00:00Z') });
  const failed = await listLocations({ dir, now: new Date('2026-11-21T00:00:00Z') });
  assert.equal(failed.importStatus.state, 'failed');
  assert.match(failed.importStatus.error, /timeout/);
  assert.equal(failed.importStatus.lastSuccess, '2026-11-09T13:00:00.000Z');
  assert.equal(failed.locations.find((location) => location.id === 'union-square').citationCount, 2, 'stored records remain after a failed refresh');
});

test('live store: a citation code at two verified locations appears as a regional signal on both', async () => {
  const dir = await liveStore(async () => [...rows, { ...rows[0], camis: '2', inspection_date: '2026-10-01T00:00:00.000' }]);
  const detail = await getLocationDetail('dumbo', { dir });
  assert.deepEqual(detail.regionalSignals.map((signal) => [signal.code, signal.locationCount]), [['06D', 2]]);
  assert.equal(detail.flags.filter((flag) => flag.type === 'Repeat code').length, 0, 'one citation at this location is not a repeat');
});

test('a location removed from the directory leaves the list but its follow-ups stay reachable', async () => {
  const dir = await liveStore();
  await updateDb((db) => { db.followUps.f = { id: 'f', locationId: 'union-square', citationId: null, checkId: 'x', status: 'Open', dueDate: '2099-01-01', createdAt: '2026-11-09T00:00:00Z' }; }, dir);
  await syncDirectory({ snapshot: { ...snapshot, locations: snapshot.locations.filter((item) => item.id !== 'union-square') }, dir });
  assert.ok(!(await listLocations({ dir })).locations.some((location) => location.id === 'union-square'));
  assert.equal((await getLocationDetail('union-square', { dir })).followUps.length, 1);
});
