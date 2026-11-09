import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { confirmMatch, matchLocationsToCity, refreshInspections, syncDirectory } from '../lib/server/importer.js';
import { getLocationDetail, listLocations } from '../lib/server/service.js';
import { readDb, updateDb } from '../lib/server/store.js';

const listing = (id, street, zip) => ({ id, name: `Sweetgreen ${id}`, street, zip, address: `${street}, New York, NY ${zip}`, sourceUrl: 'u' });
const snapshot = { fetchedAt: '2026-11-09T12:00:00.000Z', sourceUrl: 'u', locations: [listing('a', '870 Broadway', '10003'), listing('b', '50 Washington St', '11201')] };
const permitAtA = (camis) => ({ camis, dba: 'SWEETGREEN', building: '870', street: 'BROADWAY', zipcode: '10003', latitude: '40.7339', longitude: '-73.9904' });
const permitAtB = (camis) => ({ camis, dba: 'SWEETGREEN', building: '50', street: 'WASHINGTON STREET', zipcode: '11201', latitude: '40.70', longitude: '-73.99' });
const row = (camis) => ({ camis, inspection_date: '2026-09-18T00:00:00.000', inspection_type: 'Cycle', violation_code: '06D', violation_description: 'Surface', critical_flag: 'Critical' });
const client = (establishments, rows = []) => ({ findSweetgreenEstablishments: async () => establishments, findEstablishmentsAtAddress: async () => [], fetchInspectionRows: async () => rows });

// A holds permit 123 and has been imported, so it has a refresh time and stored inspections.
async function importedStoreForA() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'fsf-fresh-'));
  await syncDirectory({ snapshot, dir });
  await matchLocationsToCity({ client: client([permitAtA('123')]), dir });
  await refreshInspections({ client: client([permitAtA('123')], [row('123')]), dir });
  assert.equal((await getLocationDetail('a', { dir })).location.dataState, 'records');
  return dir;
}

const stateOf = async (dir, id) => (await getLocationDetail(id, { dir })).location;

test('when matching moves a location to a new permit, it reports not-imported until that permit is imported', async () => {
  const dir = await importedStoreForA();
  await matchLocationsToCity({ client: client([permitAtA('456')]), dir });
  const moved = await stateOf(dir, 'a');
  assert.equal(moved.camis, '456');
  assert.equal(moved.lastRefreshed, null, 'the old permit’s refresh time does not carry over');
  assert.equal(moved.dataState, 'not-imported', 'nothing says permit 456 was checked');
  assert.equal((await listLocations({ dir })).locations.find((location) => location.id === 'a').dataState, 'not-imported');

  await refreshInspections({ client: client([permitAtA('456')], []), dir });
  const imported = await stateOf(dir, 'a');
  assert.equal(imported.dataState, 'no-records', 'after a successful import that finds nothing, the city really has no records');
  assert.ok(imported.lastRefreshed);
});

test('when the manager confirms a permit for a location with an old refresh time, it reports not-imported', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'fsf-fresh-'));
  await syncDirectory({ snapshot, dir });
  await updateDb((db) => {
    Object.assign(db.locations.b, { matchStatus: 'candidate', camis: null, candidates: [{ camis: '456', dba: 'SWEETGREEN', coordinates: null }], lastRefreshed: '2026-11-01T00:00:00.000Z' });
  }, dir);
  await confirmMatch({ locationId: 'b', camis: '456', dir });
  const confirmed = await stateOf(dir, 'b');
  assert.equal(confirmed.camis, '456');
  assert.equal(confirmed.lastRefreshed, null);
  assert.equal(confirmed.dataState, 'not-imported');
});

test('a location that loses its permit to another location no longer shows a refresh time', async () => {
  const dir = await importedStoreForA();
  await matchLocationsToCity({ client: client([permitAtB('123')]), dir });
  const db = await readDb(dir);
  assert.equal(db.locations.a.camis, null);
  assert.equal(db.locations.a.lastRefreshed, null);
  assert.equal(db.locations.b.camis, '123');
  assert.equal(db.locations.b.lastRefreshed, null, 'and the location that gained it has not imported it yet');
});

test('matching the same permit again keeps the refresh time', async () => {
  const dir = await importedStoreForA();
  const before = (await readDb(dir)).locations.a.lastRefreshed;
  assert.ok(before);
  await matchLocationsToCity({ client: client([permitAtA('123')]), dir });
  assert.equal((await readDb(dir)).locations.a.lastRefreshed, before);
  assert.equal((await stateOf(dir, 'a')).dataState, 'records');
});
