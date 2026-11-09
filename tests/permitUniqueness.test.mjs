import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { confirmMatch, matchLocationsToCity, syncDirectory } from '../lib/server/importer.js';
import { matchLocation, matchLocations } from '../lib/server/matching.js';
import { getLocationDetail } from '../lib/server/service.js';
import { createFollowUp } from '../lib/server/mutations.js';
import { readDb, updateDb } from '../lib/server/store.js';

const permit = (camis, extra = {}) => ({ camis, dba: 'SWEETGREEN', building: '870', street: 'BROADWAY', zipcode: '10003', latitude: '40.7339', longitude: '-73.9904', ...extra });
const listing = (id) => ({ id, name: `Sweetgreen ${id}`, street: '870 Broadway', zip: '10003', address: '870 Broadway, New York, NY 10003', sourceUrl: 'u' });
const snapshot = { fetchedAt: '2026-11-09T12:00:00.000Z', sourceUrl: 'u', locations: [listing('x'), listing('y')] };
const client = (establishments) => ({ findSweetgreenEstablishments: async () => establishments, findEstablishmentsAtAddress: async () => [], fetchInspectionRows: async () => [] });

test('a permit already matched to another location is not verified, even when address and name match exactly', () => {
  const result = matchLocation({ street: '870 Broadway', zip: '10003' }, [permit('123')], new Set(['123']));
  assert.notEqual(result.matchStatus, 'verified');
  assert.equal(result.camis, null);
  assert.equal(matchLocation({ street: '870 Broadway', zip: '10003' }, [permit('123')], new Set()).camis, '123', 'unclaimed, the same match still verifies');
});

test('two listed locations that match one permit are both left for the manager, and the permit is offered to neither automatically', () => {
  const results = matchLocations([{ id: 'x', street: '870 Broadway', zip: '10003' }, { id: 'y', street: '870 Broadway', zip: '10003' }], [permit('123')]);
  for (const id of ['x', 'y']) {
    assert.equal(results[id].matchStatus, 'candidate', id);
    assert.equal(results[id].camis, null, id);
    assert.match(results[id].candidates[0].reason, /Another listed location matches the same permit/);
  }
});

test('a manager-confirmed permit is never verified for another location by a later automatic match', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'fsf-unique-'));
  await syncDirectory({ snapshot, dir });
  await updateDb((db) => { Object.assign(db.locations.x, { matchStatus: 'candidate', candidates: [{ camis: '123', dba: 'SWEETGREEN', coordinates: null }] }); }, dir);
  await confirmMatch({ locationId: 'x', camis: '123', dir });
  await matchLocationsToCity({ client: client([permit('123')]), dir });
  const { locations } = await readDb(dir);
  assert.deepEqual([locations.x.matchStatus, locations.x.camis, locations.x.confirmedByManager], ['verified', '123', true]);
  assert.deepEqual([locations.y.matchStatus, locations.y.camis], ['unverified', null], 'the other location does not take the confirmed permit');
});

test('a location verified automatically loses a permit the manager later confirms elsewhere, keeping follow-up context', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'fsf-unique-'));
  await syncDirectory({ snapshot, dir });
  await updateDb((db) => {
    Object.assign(db.locations.y, { matchStatus: 'verified', camis: '123', coordinates: [40.73, -73.99] });
    db.inspections.y = [{ id: 'i-123-20260918-cycle', camis: '123', date: '2026-09-18', type: 'Cycle', source: 'Public NYC inspection', citations: [{ id: 'c-old', code: '06D', description: 'Surface', critical: true }, { id: 'c-other', code: '10F', description: 'Equipment', critical: false }] }];
    Object.assign(db.locations.x, { matchStatus: 'candidate', candidates: [{ camis: '123', dba: 'SWEETGREEN', coordinates: null }] });
  }, dir);
  await createFollowUp({ locationId: 'y', citationId: 'c-old', owner: 'Manager', dueDate: '2026-12-01', notes: 'Re-clean and verify.' }, { dir });
  // Confirming the same permit for x is refused while y holds it, so release y first, as the manager would.
  await assert.rejects(confirmMatch({ locationId: 'x', camis: '123', dir }), /already matched to y/);
  await updateDb((db) => { db.locations.x.matchStatus = 'verified'; db.locations.x.camis = '123'; db.locations.x.confirmedByManager = true; }, dir);
  await matchLocationsToCity({ client: client([permit('123')]), dir });
  const db = await readDb(dir);
  assert.deepEqual([db.locations.x.camis, db.locations.x.confirmedByManager], ['123', true], 'the confirmed location keeps the permit');
  assert.deepEqual([db.locations.y.matchStatus, db.locations.y.camis], ['unverified', null], 'the other location is reset');
  const detail = await getLocationDetail('y', { dir });
  assert.deepEqual(detail.inspections.flatMap((inspection) => inspection.citations.map((citation) => citation.id)), ['c-old'], 'only the followed-up finding stays, as history');
  assert.equal(detail.followUps.length, 1);
});
