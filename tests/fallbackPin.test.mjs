import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { matchLocationsToCity, syncDirectory } from '../lib/server/importer.js';
import { seedSample } from '../lib/server/sample.js';
import { getLocationDetail, listLocations } from '../lib/server/service.js';

const listing = (id, street, zip, coordinates) => ({ id, name: `Sweetgreen ${id}`, street, zip, address: `${street}, New York, NY ${zip}`, sourceUrl: 'u', coordinates, phone: '6468915700' });
const snapshot = {
  fetchedAt: '2026-11-09T12:00:00.000Z', sourceUrl: 'u',
  locations: [
    listing('placed', '870 Broadway', '10003', [40.7339, -73.9904]),
    listing('unplaced', '7 Pennsylvania Plaza', '10001', [40.75158, -73.99371]),
    listing('unmatched', '1 Nowhere Street', '10013', [40.7275, -74.0092]),
    { ...listing('no-position', '2 Nowhere Street', '10013', null), phone: null },
  ],
};
// 'placed' has usable city coordinates; 'unplaced' matches a city record whose coordinates are 0, 0 (the Penn Plaza case).
const establishments = [
  { camis: '1', dba: 'SWEETGREEN', building: '870', street: 'BROADWAY', zipcode: '10003', latitude: '40.7340', longitude: '-73.9905' },
  { camis: '2', dba: 'SWEETGREEN', building: '7', street: 'PENNSYLVANIA PLAZA', zipcode: '10001', latitude: '0', longitude: '0' },
];

async function store() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'fsf-pin-'));
  await syncDirectory({ snapshot, dir });
  await matchLocationsToCity({ client: { findSweetgreenEstablishments: async () => establishments, findEstablishmentsAtAddress: async () => [], fetchInspectionRows: async () => [] }, dir });
  return dir;
}

test('a location whose city record has no usable position gets Sweetgreen’s published position, with the source named', async () => {
  const { locations } = await listLocations({ dir: await store() });
  const row = Object.fromEntries(locations.map((location) => [location.id, location]));
  assert.deepEqual([row.unplaced.matchStatus, row.unplaced.coordinates, row.unplaced.coordinatesSource], ['verified', [40.75158, -73.99371], 'Location list position']);
});

test('a location with a usable city position keeps it, and the source says so', async () => {
  const { locations } = await listLocations({ dir: await store() });
  const placed = locations.find((location) => location.id === 'placed');
  assert.deepEqual([placed.coordinates, placed.coordinatesSource], [[40.734, -73.9905], 'NYC Open Data inspection record']);
});

test('an unmatched location can still be placed from its own page, and one with no position stays off the map', async () => {
  const { locations } = await listLocations({ dir: await store() });
  const row = Object.fromEntries(locations.map((location) => [location.id, location]));
  assert.deepEqual([row.unmatched.matchStatus, row.unmatched.coordinates, row.unmatched.coordinatesSource], ['unverified', [40.7275, -74.0092], 'Location list position']);
  assert.deepEqual([row['no-position'].coordinates, row['no-position'].coordinatesSource], [null, null]);
});

test('the detail view reports the same position and source as the list', async () => {
  const dir = await store();
  const { location } = await getLocationDetail('unplaced', { dir });
  assert.deepEqual([location.coordinates, location.coordinatesSource], [[40.75158, -73.99371], 'Location list position']);
});

test('sample locations name the sample fixture as their source, and a missing position stays empty', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'fsf-pin-sample-'));
  await seedSample({ dir });
  const row = Object.fromEntries((await listLocations({ dir })).locations.map((location) => [location.id, location]));
  assert.equal(row['sample-midtown'].coordinatesSource, 'Sample fixture');
  assert.deepEqual([row['sample-queens'].coordinates, row['sample-queens'].coordinatesSource], [null, null]);
});
