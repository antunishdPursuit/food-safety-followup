import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { matchLocationsToCity, refreshInspections, syncDirectory } from '../lib/server/importer.js';
import { createFollowUp } from '../lib/server/mutations.js';
import { getLocationDetail } from '../lib/server/service.js';
import { readDb, updateDb } from '../lib/server/store.js';

const listing = (id, street, zip) => ({ id, name: `Sweetgreen ${id}`, street, zip, address: `${street}, New York, NY ${zip}`, sourceUrl: 'u' });
const snapshot = { fetchedAt: '2026-11-09T12:00:00.000Z', sourceUrl: 'u', locations: [listing('a', '870 Broadway', '10003'), listing('b', '50 Washington St', '11201')] };
const permitAtA = (camis = '123') => ({ camis, dba: 'SWEETGREEN', building: '870', street: 'BROADWAY', zipcode: '10003', latitude: '40.7339', longitude: '-73.9904' });
const permitAtB = (camis = '123') => ({ camis, dba: 'SWEETGREEN', building: '50', street: 'WASHINGTON STREET', zipcode: '11201', latitude: '40.70', longitude: '-73.99' });
const row = (camis, date, code) => ({ camis, inspection_date: `${date}T00:00:00.000`, inspection_type: 'Cycle', violation_code: code, violation_description: `Finding ${code}`, critical_flag: 'Critical' });
const client = (establishments, rows = []) => ({ findSweetgreenEstablishments: async () => establishments, findEstablishmentsAtAddress: async () => [], fetchInspectionRows: async () => rows });

const holdersOf = async (dir, camis) => Object.values((await readDb(dir)).locations).filter((location) => location.matchStatus === 'verified' && location.camis === camis).map((location) => location.id);

// A is verified automatically with permit 123 and has a follow-up on one of its citations.
async function storeWhereAHoldsThePermit() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'fsf-dup-'));
  const rows = [row('123', '2026-09-18', '06D'), row('123', '2026-09-18', '10F')];
  await syncDirectory({ snapshot, dir });
  await matchLocationsToCity({ client: client([permitAtA()]), dir });
  await refreshInspections({ client: client([permitAtA()], rows), dir });
  const detail = await getLocationDetail('a', { dir });
  const cited = detail.inspections.flatMap((inspection) => inspection.citations).find((citation) => citation.code === '06D');
  await createFollowUp({ locationId: 'a', citationId: cited.id, owner: 'Manager', dueDate: '2026-12-01', notes: 'Re-clean and verify.' }, { dir });
  assert.deepEqual(await holdersOf(dir, '123'), ['a'], 'before the city changes, only a holds the permit');
  return { dir, cited };
}

test('when the city later lists a permit at another location, the earlier automatic holder does not keep it too', async () => {
  const { dir, cited } = await storeWhereAHoldsThePermit();
  const summary = await matchLocationsToCity({ client: client([permitAtB()]), dir });
  assert.deepEqual(await holdersOf(dir, '123'), ['b'], 'the permit belongs to one location');
  const db = await readDb(dir);
  assert.deepEqual([db.locations.a.matchStatus, db.locations.a.camis, db.locations.b.matchStatus], ['unverified', null, 'verified']);
  assert.deepEqual(summary, { verified: 1, candidate: 0, unverified: 1 }, 'the summary matches what was saved');
  const detail = await getLocationDetail('a', { dir });
  assert.deepEqual(detail.inspections.flatMap((inspection) => inspection.citations.map((citation) => citation.id)), [cited.id], 'only the followed-up finding stays, as history');
  assert.equal(detail.inspections[0].previousPermit, true);
  assert.equal(detail.followUps.length, 1);
  assert.equal(detail.location.citationCount, null, 'history is not counted for the location that lost the permit');
});

test('running the match again does not bring the duplicate back', async () => {
  const { dir } = await storeWhereAHoldsThePermit();
  await matchLocationsToCity({ client: client([permitAtB()]), dir });
  await matchLocationsToCity({ client: client([permitAtB()]), dir });
  assert.deepEqual(await holdersOf(dir, '123'), ['b']);
});

test('a retained automatic match still survives a lookup that finds less, when no other location has the permit', async () => {
  const { dir } = await storeWhereAHoldsThePermit();
  await matchLocationsToCity({ client: client([]), dir });
  assert.deepEqual(await holdersOf(dir, '123'), ['a']);
});

test('a manager-confirmed holder keeps the permit and an automatic holder of the same permit loses it', async () => {
  const { dir } = await storeWhereAHoldsThePermit();
  await updateDb((db) => { Object.assign(db.locations.b, { matchStatus: 'verified', camis: '123', confirmedByManager: true }); }, dir);
  await matchLocationsToCity({ client: client([]), dir });
  assert.deepEqual(await holdersOf(dir, '123'), ['b']);
  assert.equal((await readDb(dir)).locations.a.matchStatus, 'unverified');
});

test('two stored automatic holders of one permit, with nothing to decide between them, are both released for the manager', async () => {
  const { dir } = await storeWhereAHoldsThePermit();
  await updateDb((db) => { Object.assign(db.locations.b, { matchStatus: 'verified', camis: '123', coordinates: [40.7, -73.99] }); }, dir);
  assert.deepEqual((await holdersOf(dir, '123')).sort(), ['a', 'b'], 'an older store can already hold the duplicate');
  await matchLocationsToCity({ client: client([]), dir });
  assert.deepEqual(await holdersOf(dir, '123'), []);
});
