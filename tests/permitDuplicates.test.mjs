import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { confirmMatch, matchLocationsToCity, refreshInspections, syncDirectory } from '../lib/server/importer.js';
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

test('retained automatic permits are not offered to other locations, while free candidates remain confirmable', async () => {
  const { dir } = await storeWhereAHoldsThePermit();
  await updateDb((db) => { db.locations.b.listedPhone = '2125550100'; }, dir);
  const changed = { camis: '123', dba: 'SWEETGREEN', phone: '2125550100' };
  const summary = await matchLocationsToCity({ client: client([changed]), dir });
  const db = await readDb(dir);
  assert.deepEqual(await holdersOf(dir, '123'), ['a']);
  assert.equal(db.locations.b.matchStatus, 'unverified');
  assert.deepEqual(db.locations.b.candidates, []);
  assert.deepEqual(summary, { verified: 1, candidate: 0, unverified: 1 });

  const free = { ...changed, camis: '456' };
  await matchLocationsToCity({ client: client([changed, free]), dir });
  assert.deepEqual((await readDb(dir)).locations.b.candidates.map((item) => item.camis), ['456']);
  await confirmMatch({ locationId: 'b', camis: '456', dir });
  assert.deepEqual(await holdersOf(dir, '456'), ['b']);
  assert.deepEqual(await holdersOf(dir, '123'), ['a']);
});

test('a held named permit does not hide a free differently named address candidate', async () => {
  const { dir } = await storeWhereAHoldsThePermit();
  await updateDb((db) => { db.locations.b.listedPhone = '2125550100'; }, dir);
  const held = { camis: '123', dba: 'SWEETGREEN', phone: '2125550100' };
  const free = { ...permitAtB('456'), dba: 'OTHER BUSINESS' };
  await matchLocationsToCity({ client: client([held, free]), dir });
  assert.deepEqual((await readDb(dir)).locations.b.candidates.map((item) => item.camis), ['456']);
  await confirmMatch({ locationId: 'b', camis: '456', dir });
  assert.deepEqual(await holdersOf(dir, '456'), ['b']);
  assert.deepEqual(await holdersOf(dir, '123'), ['a']);
});

test('held permits do not fill the candidate limit ahead of a free named permit', async () => {
  const { dir } = await storeWhereAHoldsThePermit();
  const held = Array.from({ length: 5 }, (_, index) => ({ camis: `00${index}`, dba: 'SWEETGREEN', phone: '2125550100' }));
  await updateDb((db) => {
    db.locations.b.listedPhone = '2125550100';
    for (const permit of held) db.locations[`holder-${permit.camis}`] = { id: `holder-${permit.camis}`, matchStatus: 'verified', camis: permit.camis, candidates: [] };
  }, dir);
  const free = { camis: '999', dba: 'SWEETGREEN', phone: '2125550100' };
  await matchLocationsToCity({ client: client([...held, free]), dir });
  assert.deepEqual((await readDb(dir)).locations.b.candidates.map((item) => item.camis), ['999']);
  await confirmMatch({ locationId: 'b', camis: '999', dir });
  assert.deepEqual(await holdersOf(dir, '999'), ['b']);
});

for (const [field, value] of [['street', 'OTHER STREET'], ['building', '999'], ['zipcode', '10001'], ['dba', 'OTHER BUSINESS']]) {
  test(`an automatic match contradicted by returned ${field} data is reset with follow-up history preserved`, async () => {
    const { dir, cited } = await storeWhereAHoldsThePermit();
    const changed = { ...permitAtA(), [field]: value };
    await matchLocationsToCity({ client: client([changed]), dir });
    const db = await readDb(dir);
    assert.notEqual(db.locations.a.matchStatus, 'verified');
    assert.equal(db.locations.a.camis, null);
    assert.equal(db.locations.a.lastRefreshed, null);
    assert.equal(db.inspections.a[0].previousPermit, true);
    assert.equal(Object.values(db.followUps)[0].citationId, cited.id);
  });
}

test('contradictory business evidence from an address lookup also resets an automatic match', async () => {
  const { dir } = await storeWhereAHoldsThePermit();
  await matchLocationsToCity({ dir, client: {
    ...client([]),
    findEstablishmentsAtAddress: async (zip, building) => zip === '10003' && building === '870' ? [{ ...permitAtA(), dba: 'OTHER BUSINESS' }] : [],
  } });
  assert.notEqual((await readDb(dir)).locations.a.matchStatus, 'verified');
});

test('a manager confirmation during a city lookup takes precedence over the pending automatic result', async () => {
  const { dir } = await storeWhereAHoldsThePermit();
  await assert.rejects(matchLocationsToCity({ dir, client: {
    ...client([]),
    findSweetgreenEstablishments: async () => {
      // Another match run offers a candidate, and the manager confirms it while this lookup is pending.
      await updateDb((db) => { Object.assign(db.locations.a, { matchStatus: 'candidate', candidates: [{ camis: '123', coordinates: null }] }); }, dir);
      await confirmMatch({ locationId: 'a', camis: '123', dir });
      return [{ ...permitAtA(), street: 'OTHER STREET' }];
    },
  } }), /changed during the city lookup/);
  const db = await readDb(dir);
  assert.equal(db.locations.a.confirmedByManager, true);
  assert.equal(db.locations.a.matchStatus, 'verified');
  assert.equal(db.locations.a.camis, '123');
  assert.notEqual(db.inspections.a[0].previousPermit, true);
});

test('a newer automatic permit is not reset by a pending contradiction of the old permit', async () => {
  const { dir } = await storeWhereAHoldsThePermit();
  await assert.rejects(matchLocationsToCity({ dir, client: {
    ...client([]),
    findSweetgreenEstablishments: async () => {
      await matchLocationsToCity({ dir, client: client([permitAtA('456')]) });
      return [{ ...permitAtA(), street: 'OTHER STREET' }];
    },
  } }), /changed during the city lookup/);
  const db = await readDb(dir);
  assert.equal(db.locations.a.matchStatus, 'verified');
  assert.equal(db.locations.a.camis, '456');
  assert.equal(db.locations.a.lastRefreshed, null);
});

for (const [street, zip] of [['999 Broadway', '10003'], ['870 Broadway', '10001']]) {
  test(`a directory change to ${street} ${zip} during matching cannot restore the old permit`, async () => {
    const { dir, cited } = await storeWhereAHoldsThePermit();
    await assert.rejects(matchLocationsToCity({ dir, client: {
      ...client([]),
      findSweetgreenEstablishments: async () => {
        await syncDirectory({ snapshot: { ...snapshot, locations: [listing('a', street, zip), snapshot.locations[1]] }, dir });
        return [permitAtA()];
      },
    } }), /changed during the city lookup/);
    const db = await readDb(dir);
    assert.equal(db.locations.a.street, street);
    assert.equal(db.locations.a.zip, zip);
    assert.equal(db.locations.a.matchStatus, 'unverified');
    assert.equal(db.locations.a.camis, null);
    assert.equal(db.locations.a.lastRefreshed, null);
    assert.equal(db.inspections.a[0].previousPermit, true);
    assert.equal(Object.values(db.followUps)[0].citationId, cited.id);
  });
}

test('an earlier verified lookup cannot overwrite a newer verified permit assignment', async () => {
  const { dir } = await storeWhereAHoldsThePermit();
  await assert.rejects(matchLocationsToCity({ dir, client: {
    ...client([]),
    findSweetgreenEstablishments: async () => {
      await matchLocationsToCity({ dir, client: client([permitAtA('456')]) });
      return [permitAtA('123')];
    },
  } }), /changed during the city lookup/);
  assert.equal((await readDb(dir)).locations.a.camis, '456');
  assert.equal((await readDb(dir)).locations.a.matchStatus, 'verified');
});

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
