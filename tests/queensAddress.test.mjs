import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildingMatches, buildingVariants } from '../lib/server/address.js';
import { matchLocation } from '../lib/server/matching.js';
import { matchLocationsToCity, syncDirectory } from '../lib/server/importer.js';
import { readDb, updateDb } from '../lib/server/store.js';
import { createFollowUp } from '../lib/server/mutations.js';

const location = { id: 'queens', name: 'Sweetgreen Queens', street: '25-35 44th Drive', zip: '11101', address: '25-35 44th Drive, Queens, NY 11101', sourceUrl: 'u' };
const permit = (building) => ({ camis: '123', dba: 'SWEETGREEN', building, street: '44 DRIVE', zipcode: '11101', boro: 'Queens' });

test('Queens grid numbers do not match either endpoint or an interior building number', () => {
  for (const recorded of ['25', '30', '35']) {
    assert.equal(buildingMatches('25-35', recorded, 'Queens'), false);
    assert.equal(matchLocation(location, [permit(recorded)]).matchStatus, 'unverified');
  }
  assert.equal(matchLocation(location, [permit('25-35')]).matchStatus, 'verified');
  assert.equal(buildingMatches('25-35', '30'), false, 'unknown boroughs do not expand ambiguous numbers');
});

test('Queens lookups keep the full number while Brooklyn range lookups retain endpoints', () => {
  assert.deepEqual(buildingVariants('25-35', 'Queens'), ['25-35']);
  assert.deepEqual(buildingVariants('25-35'), ['25-35']);
  assert.deepEqual(buildingVariants('76-78', 'Brooklyn'), ['76-78', '76', '78']);
});

test('the importer does not query Queens grid endpoints or verify an unrelated interior address', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'fsf-queens-'));
  await syncDirectory({ snapshot: { fetchedAt: '2026-11-09T12:00:00Z', sourceUrl: 'u', locations: [location] }, dir });
  const queried = [];
  await matchLocationsToCity({ dir, client: {
    findSweetgreenEstablishments: async () => [permit('30')],
    findEstablishmentsAtAddress: async (zip, building) => { queried.push([zip, building]); return []; },
  } });
  assert.deepEqual(queried, [['11101', '25-35']]);
  assert.equal((await readDb(dir)).locations.queens.matchStatus, 'unverified');
});

test('rematching clears an existing false automatic Queens match and preserves followed-up history', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'fsf-queens-'));
  await syncDirectory({ snapshot: { fetchedAt: '2026-11-09T12:00:00Z', sourceUrl: 'u', locations: [location] }, dir });
  await updateDb((db) => {
    Object.assign(db.locations.queens, { camis: '123', matchStatus: 'verified', lastRefreshed: '2026-11-09T12:00:00Z' });
    db.inspections.queens = [{ id: 'old', camis: '123', date: '2026-10-01', type: 'Cycle', citations: [{ id: 'old-citation', code: '06D', description: 'Old finding' }] }];
  }, dir);
  await createFollowUp({ locationId: 'queens', citationId: 'old-citation', owner: 'Manager', dueDate: '2026-12-01', notes: 'Preserve the source context.' }, { dir });
  const client = { findSweetgreenEstablishments: async () => [], findEstablishmentsAtAddress: async () => [] };
  await matchLocationsToCity({ dir, client });
  assert.equal((await readDb(dir)).locations.queens.camis, '123', 'an absent city record alone does not erase an existing match');

  await matchLocationsToCity({ dir, client: { ...client, findSweetgreenEstablishments: async () => [permit('30')] } });
  const db = await readDb(dir);
  assert.equal(db.locations.queens.matchStatus, 'unverified');
  assert.equal(db.locations.queens.camis, null);
  assert.equal(db.locations.queens.lastRefreshed, null);
  assert.equal(db.inspections.queens[0].previousPermit, true);
  assert.equal(Object.values(db.followUps)[0].citationId, 'old-citation');
});
