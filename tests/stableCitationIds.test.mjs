import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { matchLocationsToCity, refreshInspections, syncDirectory } from '../lib/server/importer.js';
import { createFollowUp } from '../lib/server/mutations.js';
import { readDb } from '../lib/server/store.js';

const snapshot = {
  fetchedAt: '2026-11-09T12:00:00.000Z',
  sourceUrl: 'u',
  locations: [{ id: 'a', name: 'Sweetgreen a', street: '870 Broadway', zip: '10003', address: '870 Broadway, New York, NY 10003', sourceUrl: 'u' }],
};
const establishments = [{ camis: '1', dba: 'SWEETGREEN', building: '870', street: 'BROADWAY', zipcode: '10003', latitude: '40.73', longitude: '-73.99' }];
// One inspection can cite the same code twice with different wording, so identity is code plus description plus flag.
const row = (code, description) => ({ camis: '1', inspection_date: '2026-09-18T00:00:00.000', inspection_type: 'Cycle', violation_code: code, violation_description: description, critical_flag: 'Critical' });
const client = (rows) => ({ findSweetgreenEstablishments: async () => establishments, findEstablishmentsAtAddress: async () => [], fetchInspectionRows: async () => rows });

const first = [row('06D', 'A first'), row('06D', 'B second'), row('10F', 'Equipment')];

async function storeAfterImport(rows = first) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'fsf-ids-'));
  await syncDirectory({ snapshot, dir });
  await matchLocationsToCity({ client: client(rows), dir });
  await refreshInspections({ client: client(rows), dir });
  return dir;
}

const citationsOf = async (dir) => (await readDb(dir)).inspections.a.flatMap((inspection) => inspection.citations);
const byDescription = (citations, description) => citations.find((citation) => citation.description === description);

test('a first import numbers same-code findings by position, and importing the same rows again changes no id', async () => {
  const dir = await storeAfterImport();
  const before = (await citationsOf(dir)).map((citation) => [citation.id, citation.description]);
  const suffixes = before.map(([id]) => id.split('--')[1]).sort();
  assert.deepEqual(suffixes, ['06D', '06D-2', '10F']);
  await refreshInspections({ client: client(first), dir });
  assert.deepEqual((await citationsOf(dir)).map((citation) => [citation.id, citation.description]), before);
});

test('when the city removes the first of two same-code findings, the second keeps its id and its follow-up', async () => {
  const dir = await storeAfterImport();
  const second = byDescription(await citationsOf(dir), 'B second');
  assert.ok(second.id.endsWith('--06D-2'));
  const followUp = await createFollowUp({ locationId: 'a', citationId: second.id, owner: 'Manager', dueDate: '2026-12-01', notes: 'Re-clean.' }, { dir });

  await refreshInspections({ client: client([row('06D', 'B second'), row('10F', 'Equipment')]), dir });

  const after = await citationsOf(dir);
  assert.equal(byDescription(after, 'B second').id, second.id, 'the finding keeps the id it was given');
  assert.equal(byDescription(after, 'A first'), undefined, 'the removed finding had no follow-up, so it is gone');
  const db = await readDb(dir);
  assert.equal(db.followUps[followUp.id].citationId, second.id);
  assert.equal(after.find((citation) => citation.id === db.followUps[followUp.id].citationId).description, 'B second', 'the follow-up still points at the same finding');
});

test('a retained removed finding keeps its id, and a new finding of the same code takes a free one', async () => {
  const dir = await storeAfterImport();
  const removedLater = byDescription(await citationsOf(dir), 'A first');
  const followUp = await createFollowUp({ locationId: 'a', citationId: removedLater.id, owner: 'Manager', dueDate: '2026-12-01', notes: 'Re-clean.' }, { dir });

  await refreshInspections({ client: client([row('06D', 'B second'), row('06D', 'C third'), row('10F', 'Equipment')]), dir });

  const after = await citationsOf(dir);
  const kept = after.find((citation) => citation.id === followUp.citationId);
  assert.equal(kept.description, 'A first', 'the follow-up still names the finding it was made for');
  assert.equal(kept.removedFromSource, true);
  assert.equal(new Set(after.map((citation) => citation.id)).size, after.length, 'no two findings share an id');
  assert.equal(byDescription(after, 'B second').removedFromSource, undefined);
  assert.equal(byDescription(after, 'C third').removedFromSource, undefined);
});

test('the city listing the same findings in a different order does not move any id', async () => {
  const dir = await storeAfterImport();
  const before = Object.fromEntries((await citationsOf(dir)).map((citation) => [citation.description, citation.id]));
  await refreshInspections({ client: client([row('10F', 'Equipment'), row('06D', 'B second'), row('06D', 'A first')]), dir });
  assert.deepEqual(Object.fromEntries((await citationsOf(dir)).map((citation) => [citation.description, citation.id])), before);
});

test('a removed finding that comes back is the same finding, not a copy beside it', async () => {
  const dir = await storeAfterImport();
  const firstFinding = byDescription(await citationsOf(dir), 'A first');
  await createFollowUp({ locationId: 'a', citationId: firstFinding.id, owner: 'Manager', dueDate: '2026-12-01', notes: 'Re-clean.' }, { dir });
  await refreshInspections({ client: client([row('06D', 'B second'), row('10F', 'Equipment')]), dir });
  await refreshInspections({ client: client(first), dir });
  const after = await citationsOf(dir);
  assert.equal(after.filter((citation) => citation.description === 'A first').length, 1);
  assert.equal(byDescription(after, 'A first').id, firstFinding.id);
  assert.equal(byDescription(after, 'A first').removedFromSource, undefined, 'current again');
});
