import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { confirmMatch, matchLocationsToCity, mergeInspections, refreshInspections, syncDirectory } from '../lib/server/importer.js';
import { readDb, updateDb } from '../lib/server/store.js';

const snapshot = {
  fetchedAt: '2026-11-09T12:00:00.000Z',
  sourceUrl: 'https://www.sweetgreen.com/locations',
  locations: [
    { id: 'union-square', name: 'Sweetgreen Union Square', street: '870 Broadway', zip: '10003', address: '870 Broadway, New York, NY 10003', sourceUrl: 'https://www.sweetgreen.com/locations/union-square' },
    { id: 'dumbo', name: 'Sweetgreen DUMBO', street: '50 Washington St', zip: '11201', address: '50 Washington St, Brooklyn, NY 11201', sourceUrl: 'https://www.sweetgreen.com/locations/dumbo' },
    { id: 'nolita', name: 'Sweetgreen Nolita', street: '100 Kenmare St', zip: '10012', address: '100 Kenmare St, New York, NY 10012', sourceUrl: 'https://www.sweetgreen.com/locations/nolita' },
  ],
};

const establishments = [
  { camis: '50001', dba: 'SWEETGREEN', building: '870', street: 'BROADWAY', zipcode: '10003', latitude: '40.7339', longitude: '-73.9904' },
  { camis: '50002', dba: 'JUICE BAR', building: '50', street: 'WASHINGTON STREET', zipcode: '11201', latitude: '40.70', longitude: '-73.99' },
];

const inspectionRows = (extra = []) => [
  { camis: '50001', inspection_date: '2026-09-18T00:00:00.000', inspection_type: 'Cycle Inspection / Initial Inspection', violation_code: '06D', violation_description: 'Surface', critical_flag: 'Critical' },
  { camis: '50001', inspection_date: '2026-09-18T00:00:00.000', inspection_type: 'Cycle Inspection / Initial Inspection', violation_code: '10F', violation_description: 'Equipment', critical_flag: 'Not Critical' },
  { camis: '50001', inspection_date: '2026-10-08T00:00:00.000', inspection_type: 'Cycle Inspection / Re-inspection', action: 'No violations were recorded at the time of this inspection.', critical_flag: 'Not Applicable' },
  ...extra,
];

const fakeClient = (overrides = {}) => ({
  findSweetgreenEstablishments: async () => establishments,
  findEstablishmentsAtAddress: async () => [],
  fetchInspectionRows: async () => inspectionRows(),
  ...overrides,
});

async function preparedStore(client = fakeClient()) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'fsf-import-'));
  await syncDirectory({ snapshot, dir });
  await matchLocationsToCity({ client, dir });
  return dir;
}

test('syncing lists every directory location as unverified until it is matched', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'fsf-import-'));
  await syncDirectory({ snapshot, dir });
  const db = await readDb(dir);
  assert.equal(Object.keys(db.locations).length, 3);
  assert.ok(Object.values(db.locations).every((location) => location.matchStatus === 'unverified' && location.camis === null));
});

test('matching verifies one location, offers a candidate for another, and leaves the third unverified', async () => {
  const dir = await preparedStore();
  const { locations } = await readDb(dir);
  assert.equal(locations['union-square'].matchStatus, 'verified');
  assert.equal(locations['union-square'].camis, '50001');
  assert.deepEqual(locations['union-square'].coordinates, [40.7339, -73.9904]);
  assert.equal(locations.dumbo.matchStatus, 'candidate');
  assert.equal(locations.dumbo.camis, null);
  assert.equal(locations.nolita.matchStatus, 'unverified');
});

test('importing groups city rows by inspection and keeps every other location untouched', async () => {
  const dir = await preparedStore();
  const result = await refreshInspections({ client: fakeClient(), dir, now: new Date('2026-11-09T13:00:00Z') });
  assert.deepEqual(result, { ok: true, locations: 1, inspections: 2, citations: 2 });
  const db = await readDb(dir);
  assert.equal(db.inspections['union-square'].length, 2);
  assert.equal(db.inspections.dumbo, undefined);
  assert.equal(db.locations['union-square'].lastRefreshed, '2026-11-09T13:00:00.000Z');
  assert.equal(db.importStatus.lastSuccess, '2026-11-09T13:00:00.000Z');
  assert.equal(db.importStatus.error, null);
});

test('importing twice produces the same records and ids, with no duplicates', async () => {
  const dir = await preparedStore();
  await refreshInspections({ client: fakeClient(), dir });
  const first = (await readDb(dir)).inspections['union-square'];
  await refreshInspections({ client: fakeClient(), dir });
  const second = (await readDb(dir)).inspections['union-square'];
  assert.deepEqual(second, first);
});

test('a failed city refresh keeps stored records and follow-ups, and records the error', async () => {
  const dir = await preparedStore();
  await refreshInspections({ client: fakeClient(), dir, now: new Date('2026-11-09T13:00:00Z') });
  await updateDb((db) => { db.followUps.f1 = { id: 'f1', locationId: 'union-square', citationId: 'x' }; }, dir);
  const failing = fakeClient({ fetchInspectionRows: async () => { throw new Error('NYC Open Data request failed. timeout'); } });
  const result = await refreshInspections({ client: failing, dir, now: new Date('2026-11-10T13:00:00Z') });
  assert.equal(result.ok, false);
  const db = await readDb(dir);
  assert.equal(db.inspections['union-square'].length, 2);
  assert.ok(db.followUps.f1);
  assert.equal(db.importStatus.lastSuccess, '2026-11-09T13:00:00.000Z');
  assert.equal(db.importStatus.lastAttempt, '2026-11-10T13:00:00.000Z');
  assert.match(db.importStatus.error, /timeout/);
});

test('a manager-confirmed candidate becomes verified and survives later automatic matching', async () => {
  const dir = await preparedStore();
  await assert.rejects(confirmMatch({ locationId: 'dumbo', camis: '99999', dir }), /not a candidate/);
  await assert.rejects(confirmMatch({ locationId: 'nope', camis: '50002', dir }), /Unknown location/);
  await confirmMatch({ locationId: 'dumbo', camis: '50002', dir });
  await matchLocationsToCity({ client: fakeClient(), dir });
  const { locations } = await readDb(dir);
  assert.equal(locations.dumbo.matchStatus, 'verified');
  assert.equal(locations.dumbo.camis, '50002');
  assert.equal(locations.dumbo.confirmedByManager, true);
});

test('a location that changes permit loses the old permit’s inspections', async () => {
  const dir = await preparedStore();
  await refreshInspections({ client: fakeClient(), dir });
  const moved = establishments.map((item) => (item.camis === '50001' ? { ...item, camis: '50077' } : item));
  await matchLocationsToCity({ client: fakeClient({ findSweetgreenEstablishments: async () => moved }), dir });
  const db = await readDb(dir);
  assert.equal(db.locations['union-square'].camis, '50077');
  assert.equal(db.inspections['union-square'], undefined);
});

test('a citation the city dropped is kept only while a follow-up still points at it', () => {
  const stored = [{ id: 'i1', citations: [{ id: 'c1', code: '06D' }, { id: 'c2', code: '10F' }] }, { id: 'i2', citations: [{ id: 'c3', code: '04L' }] }];
  const fresh = [{ id: 'i1', citations: [{ id: 'c1', code: '06D' }] }];
  const merged = mergeInspections(stored, fresh, new Set(['c2', 'c3']));
  assert.deepEqual(merged.map((inspection) => inspection.id), ['i1', 'i2']);
  assert.deepEqual(merged[0].citations.map((citation) => [citation.id, citation.removedFromSource]), [['c1', undefined], ['c2', true]]);
  assert.equal(merged[1].removedFromSource, true);
  assert.equal(mergeInspections(stored, fresh, new Set()).length, 1);
});
