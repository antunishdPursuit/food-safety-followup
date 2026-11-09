import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { matchLocationsToCity, refreshInspections, syncDirectory } from '../lib/server/importer.js';
import { createFollowUp, setCheckLink, updateFollowUp } from '../lib/server/mutations.js';
import { currentInspections } from '../lib/server/rules.js';
import { getLocationDetail, listLocations } from '../lib/server/service.js';
import { summarizeStore } from '../lib/server/status.js';
import { readDb, updateDb } from '../lib/server/store.js';

const listing = (id, street, zip) => ({ id, name: `Sweetgreen ${id}`, street, zip, address: `${street}, New York, NY ${zip}`, sourceUrl: 'u' });
const snapshot = { fetchedAt: '2026-11-09T12:00:00.000Z', sourceUrl: 'u', locations: [listing('a', '870 Broadway', '10003'), listing('b', '50 Washington St', '11201')] };
const establishments = [
  { camis: '1', dba: 'SWEETGREEN', building: '870', street: 'BROADWAY', zipcode: '10003', latitude: '40.73', longitude: '-73.99' },
  { camis: '2', dba: 'SWEETGREEN', building: '50', street: 'WASHINGTON STREET', zipcode: '11201', latitude: '40.70', longitude: '-73.99' },
];
const row = (camis, date, code, type = 'Cycle') => ({ camis, inspection_date: `${date}T00:00:00.000`, inspection_type: type, violation_code: code, violation_description: `Finding ${code}`, critical_flag: 'Critical' });
const client = (rows) => ({ findSweetgreenEstablishments: async () => establishments, findEstablishmentsAtAddress: async () => [], fetchInspectionRows: async () => rows });

// First city response; the caller then supplies a later response in which some citations have disappeared.
async function storeAfterFirstImport() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'fsf-removed-'));
  const first = [row('1', '2026-09-18', '06D'), row('1', '2026-09-18', '04L'), row('1', '2026-08-01', '10F', 'Earlier'), row('2', '2026-09-20', '04L')];
  await syncDirectory({ snapshot, dir });
  await matchLocationsToCity({ client: client(first), dir });
  await refreshInspections({ client: client(first), dir });
  const detail = await getLocationDetail('a', { dir });
  const find = (code) => detail.inspections.flatMap((inspection) => inspection.citations).find((citation) => citation.code === code);
  return { dir, ids: { d06: find('06D').id, l04: find('04L').id, f10: find('10F').id } };
}

const refreshWith = (dir, rows) => refreshInspections({ client: client(rows), dir });
const flagIds = (detail) => detail.flags.map((flag) => flag.id);

test('a citation the city later removes keeps its follow-up context but is not current', async () => {
  const { dir, ids } = await storeAfterFirstImport();
  const followUp = await createFollowUp({ locationId: 'a', citationId: ids.d06, owner: 'Manager', dueDate: '2026-12-01', notes: 'Re-clean and verify.' }, { dir });
  // The later response drops 06D from 2026-09-18 and cites 06D again on a new date.
  await refreshWith(dir, [row('1', '2026-09-18', '04L'), row('1', '2026-08-01', '10F', 'Earlier'), row('1', '2026-10-08', '06D', 'Re-inspection'), row('2', '2026-09-20', '04L')]);
  const detail = await getLocationDetail('a', { dir });
  const removed = detail.inspections.flatMap((inspection) => inspection.citations).find((citation) => citation.id === ids.d06);
  assert.equal(removed.removedFromSource, true, 'still listed, labeled as no longer in the city records');
  assert.ok(!flagIds(detail).includes('repeat-06D'), 'a removed citation and a current one do not make a repeat');
  assert.ok(!flagIds(detail).includes(`unlinked-${ids.d06}`), 'and a removed citation raises no review flag');
  assert.equal(detail.location.citationCount, 3, 'current citations only: 04L, 10F, and the new 06D');
  assert.equal(detail.followUps[0].id, followUp.id);
  assert.equal((await updateFollowUp(followUp.id, { notes: 'Edited after the city removed the finding.' }, { dir })).notes, 'Edited after the city removed the finding.');
});

test('a removed citation is excluded from regional signals and from suggestions', async () => {
  const { dir, ids } = await storeAfterFirstImport();
  await createFollowUp({ locationId: 'a', citationId: ids.l04, owner: 'Manager', dueDate: '2026-12-01', notes: 'Pest control visit.' }, { dir });
  await updateDb((db) => { db.internalChecks.k1 = { id: 'k1', locationId: 'a', date: '2026-10-20', type: 'Audit', source: 'Fictional demo check', note: 'Fictional.', citationCode: '04L' }; }, dir);
  const before = await getLocationDetail('a', { dir });
  assert.equal(before.regionalSignals.find((signal) => signal.code === '04L')?.locationCount, 2, 'before, 04L appears at both locations');
  assert.equal(before.internalChecks[0].suggestedCitationId, ids.l04);
  await refreshWith(dir, [row('1', '2026-09-18', '06D'), row('1', '2026-08-01', '10F', 'Earlier'), row('2', '2026-09-20', '04L')]);
  const after = await getLocationDetail('a', { dir });
  assert.equal(after.regionalSignals.find((signal) => signal.code === '04L'), undefined, 'the removed 04L no longer links this location to the regional signal');
  assert.equal(after.internalChecks[0].suggestedCitationId, undefined, 'and it is no longer suggested');
  assert.equal((await getLocationDetail('b', { dir })).regionalSignals.length, 0);
});

test('a removed citation cannot be chosen for a new follow-up or a new link', async () => {
  const { dir, ids } = await storeAfterFirstImport();
  await createFollowUp({ locationId: 'a', citationId: ids.d06, owner: 'Manager', dueDate: '2026-12-01', notes: 'Re-clean and verify.' }, { dir });
  await updateDb((db) => { db.internalChecks.k1 = { id: 'k1', locationId: 'a', date: '2026-10-20', type: 'Audit', source: 'Fictional demo check', note: 'Fictional.', citationCode: '06D' }; }, dir);
  await refreshWith(dir, [row('1', '2026-09-18', '04L'), row('1', '2026-08-01', '10F', 'Earlier'), row('2', '2026-09-20', '04L')]);
  const message = 'This finding is no longer in the city records and cannot be used for new work.';
  await assert.rejects(createFollowUp({ locationId: 'a', citationId: ids.d06, owner: 'Manager', dueDate: '2026-12-02', notes: 'Another.' }, { dir }), (error) => error.fields.citationId === message);
  for (const decision of ['linked', 'dismissed']) {
    await assert.rejects(setCheckLink('k1', { decision, citationId: ids.d06 }, { dir }), (error) => error.fields.citationId === message);
  }
  await assert.rejects(setCheckLink('k1', { decision: 'linked' }, { dir }), (error) => error.fields.citationId === 'Choose the citation to link.', 'no automatic pick either');
  assert.equal((await readDb(dir)).links.k1, undefined);
});

test('a whole inspection that disappears from the city response stops counting too', async () => {
  const { dir, ids } = await storeAfterFirstImport();
  await createFollowUp({ locationId: 'a', citationId: ids.f10, owner: 'Manager', dueDate: '2026-12-01', notes: 'Check the equipment.' }, { dir });
  await refreshWith(dir, [row('1', '2026-09-18', '06D'), row('1', '2026-09-18', '04L'), row('2', '2026-09-20', '04L')]);
  const detail = await getLocationDetail('a', { dir });
  const earlier = detail.inspections.find((inspection) => inspection.date === '2026-08-01');
  assert.equal(earlier.removedFromSource, true, 'the inspection is kept for its follow-up');
  assert.equal(detail.location.citationCount, 2);
  const { locations } = await listLocations({ dir });
  assert.equal(locations.find((location) => location.id === 'a').citationCount, 2);
  const summary = summarizeStore(await readDb(dir));
  assert.equal(summary.historyCitations, 1, 'the status output counts it as history');
});

test('currentInspections drops removed findings and leaves the rest untouched', () => {
  const kept = { id: 'k', citations: [{ id: 'c1' }, { id: 'c2', removedFromSource: true }] };
  const whole = { id: 'w', removedFromSource: true, citations: [{ id: 'c3', removedFromSource: true }] };
  const earlier = { id: 'p', previousPermit: true, citations: [{ id: 'c4' }] };
  const clean = { id: 'n', citations: [{ id: 'c5' }] };
  const result = currentInspections([kept, whole, earlier, clean]);
  assert.deepEqual(result.map((inspection) => inspection.id), ['k', 'n']);
  assert.deepEqual(result[0].citations.map((citation) => citation.id), ['c1']);
  assert.equal(result[1], clean, 'an untouched inspection is returned as is');
});
