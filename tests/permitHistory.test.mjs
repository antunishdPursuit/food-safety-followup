import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { confirmMatch, matchLocationsToCity, refreshInspections, syncDirectory } from '../lib/server/importer.js';
import { createFollowUp, setCheckLink, updateFollowUp } from '../lib/server/mutations.js';
import { getLocationDetail, listLocations } from '../lib/server/service.js';
import { readDb, updateDb } from '../lib/server/store.js';

const snapshot = {
  fetchedAt: '2026-11-09T12:00:00.000Z', sourceUrl: 'https://www.sweetgreen.com/locations',
  locations: [{ id: 'union-square', name: 'Sweetgreen Union Square', street: '870 Broadway', zip: '10003', address: '870 Broadway, New York, NY 10003', sourceUrl: 'u' }],
};
const permit = (camis, extra = {}) => ({ camis, dba: 'SWEETGREEN', building: '870', street: 'BROADWAY', zipcode: '10003', latitude: '40.7339', longitude: '-73.9904', ...extra });
const row = (camis, date, code, type = 'Cycle') => ({ camis, inspection_date: `${date}T00:00:00.000`, inspection_type: type, violation_code: code, violation_description: `Finding ${code}`, critical_flag: 'Critical' });
const client = (establishments, rows) => ({ findSweetgreenEstablishments: async () => establishments, findEstablishmentsAtAddress: async () => [], fetchInspectionRows: async () => rows });

// A verified location with two citations and a follow-up on one of them.
async function storeWithFollowUp() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'fsf-history-'));
  const rows = [row('1', '2026-09-18', '06D'), row('1', '2026-09-18', '10F'), row('1', '2026-10-08', '04L', 'Re-inspection')];
  await syncDirectory({ snapshot, dir });
  await matchLocationsToCity({ client: client([permit('1')], rows), dir });
  await refreshInspections({ client: client([permit('1')], rows), dir });
  const before = await getLocationDetail('union-square', { dir });
  const cited = before.inspections.flatMap((inspection) => inspection.citations).find((citation) => citation.code === '06D');
  const followUp = await createFollowUp({ locationId: 'union-square', citationId: cited.id, owner: 'Manager', dueDate: '2026-12-01', notes: 'Re-clean and verify.' }, { dir });
  return { dir, cited, followUp };
}

const citationIds = (detail) => detail.inspections.flatMap((inspection) => inspection.citations.map((citation) => citation.id));

test('when the permit changes, a finding a follow-up points at stays as history and the rest go', async () => {
  const { dir, cited, followUp } = await storeWithFollowUp();
  await matchLocationsToCity({ client: client([permit('2')], [row('2', '2026-11-01', '08A')]), dir });
  const detail = await getLocationDetail('union-square', { dir });
  assert.equal(detail.location.camis, '2');
  assert.deepEqual(citationIds(detail), [cited.id], 'only the referenced finding remains');
  const [history] = detail.inspections;
  assert.equal(history.previousPermit, true);
  assert.equal(history.camis, '1', 'it still names the permit it came from');
  assert.equal(history.citations[0].removedFromSource, true);
  assert.equal(detail.followUps[0].id, followUp.id);
  assert.ok(!detail.flags.some((flag) => flag.id === `unlinked-${cited.id}`), 'the follow-up still covers its finding');
});

test('history survives the next import for the new permit', async () => {
  const { dir, cited } = await storeWithFollowUp();
  await matchLocationsToCity({ client: client([permit('2')], []), dir });
  await refreshInspections({ client: client([permit('2')], [row('2', '2026-11-01', '08A')]), dir });
  const detail = await getLocationDetail('union-square', { dir });
  assert.deepEqual(citationIds(detail).filter((id) => id === cited.id), [cited.id]);
  assert.equal(detail.inspections.length, 2, 'the new permit’s inspection plus the history');
  assert.equal(detail.inspections.find((inspection) => inspection.camis === '2').previousPermit, undefined);
});

test('confirming a different permit keeps referenced findings as history too', async () => {
  const { dir, cited } = await storeWithFollowUp();
  await updateDb((db) => { db.locations['union-square'].candidates = [{ camis: '9', dba: 'SWEETGREEN', coordinates: null }]; db.locations['union-square'].matchStatus = 'candidate'; }, dir);
  await confirmMatch({ locationId: 'union-square', camis: '9', dir });
  assert.deepEqual(citationIds(await getLocationDetail('union-square', { dir })), [cited.id]);
});

test('a location with no follow-up loses its old permit’s inspections entirely', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'fsf-history-'));
  const rows = [row('1', '2026-09-18', '06D')];
  await syncDirectory({ snapshot, dir });
  await matchLocationsToCity({ client: client([permit('1')], rows), dir });
  await refreshInspections({ client: client([permit('1')], rows), dir });
  await matchLocationsToCity({ client: client([permit('2')], []), dir });
  assert.equal((await readDb(dir)).inspections['union-square'], undefined);
});

test('when a location’s address changes, its match is reset and the old permit’s inspections are not shown for the new address', async () => {
  const { dir, cited } = await storeWithFollowUp();
  await updateDb((db) => { db.locations['union-square'].confirmedByManager = true; }, dir);
  const moved = { ...snapshot, locations: [{ ...snapshot.locations[0], street: '1 New Street', zip: '10010', address: '1 New Street, New York, NY 10010' }] };
  await syncDirectory({ snapshot: moved, dir });
  const detail = await getLocationDetail('union-square', { dir });
  assert.deepEqual([detail.location.matchStatus, detail.location.camis, detail.location.dataState, detail.location.coordinates], ['unverified', null, 'unmatched', null]);
  assert.deepEqual(citationIds(detail), [cited.id], 'only the follow-up’s finding remains, as history');
  assert.equal(detail.inspections[0].previousPermit, true);
  const stored = (await readDb(dir)).locations['union-square'];
  assert.deepEqual([stored.confirmedByManager, stored.lastRefreshed, stored.matchedAt], [false, null, undefined]);
  const [listRow] = (await listLocations({ dir })).locations;
  assert.deepEqual([listRow.matchStatus, listRow.citationCount, listRow.flagCount], ['unverified', null, 0], 'history does not count or raise flags');
});

test('the old match cannot come back until the new address is verified', async () => {
  const { dir } = await storeWithFollowUp();
  const moved = { ...snapshot, locations: [{ ...snapshot.locations[0], street: '1 New Street', zip: '10010', address: '1 New Street, New York, NY 10010' }] };
  await syncDirectory({ snapshot: moved, dir });
  // The city still lists only the old address, so the new address finds nothing and stays unverified.
  await matchLocationsToCity({ client: client([permit('1')], []), dir });
  assert.equal((await readDb(dir)).locations['union-square'].matchStatus, 'unverified');
  assert.equal((await refreshInspections({ client: client([permit('1')], []), dir })).skipped, true);
});

// Regression: after a permit change the detail view showed no suggestion, but the link request, sent without a
// citation id, still searched history and could pick the old permit's citation.
async function storeWithCheckAfterPermitChange() {
  const { dir, cited } = await storeWithFollowUp();
  await updateDb((db) => {
    db.internalChecks.k1 = { id: 'k1', locationId: 'union-square', date: '2026-10-20', type: 'Audit', source: 'Fictional demo check', note: 'Fictional.', citationCode: '06D' };
  }, dir);
  const before = await getLocationDetail('union-square', { dir });
  assert.equal(before.internalChecks[0].suggestedCitationId, cited.id, 'before the change the code points at the current citation');
  await matchLocationsToCity({ client: client([permit('2')], [row('2', '2026-11-01', '08A')]), dir });
  return { dir, cited };
}

test('after a permit change a link request without a citation id cannot pick the old permit’s citation', async () => {
  const { dir } = await storeWithCheckAfterPermitChange();
  const detail = await getLocationDetail('union-square', { dir });
  assert.equal(detail.internalChecks[0].suggestedCitationId, undefined, 'the detail view suggests nothing');
  await assert.rejects(setCheckLink('k1', { decision: 'linked' }, { dir }), (error) => error.status === 422 && error.fields.citationId === 'Choose the citation to link.');
  assert.equal((await readDb(dir)).links.k1, undefined, 'nothing was saved');
  const dismissed = await setCheckLink('k1', { decision: 'dismissed' }, { dir });
  assert.equal(dismissed.link.citationId, null, 'a dismissal does not record a history citation either');
});

test('after a permit change a history citation cannot be chosen explicitly for a link or a new follow-up', async () => {
  const { dir, cited } = await storeWithCheckAfterPermitChange();
  const message = 'This finding is history from a previous permit and cannot be used for new work.';
  await assert.rejects(setCheckLink('k1', { decision: 'linked', citationId: cited.id }, { dir }), (error) => error.fields.citationId === message);
  await assert.rejects(
    createFollowUp({ locationId: 'union-square', citationId: cited.id, owner: 'Manager', dueDate: '2026-12-02', notes: 'Another action.' }, { dir }),
    (error) => error.status === 422 && error.fields.citationId === message,
  );
  // The follow-up made before the change is untouched and can still be edited.
  const { followUps } = await getLocationDetail('union-square', { dir });
  assert.equal(followUps.length, 1);
  assert.equal((await updateFollowUp(followUps[0].id, { notes: 'Edited after the permit change.' }, { dir })).notes, 'Edited after the permit change.');
});

test('a current citation can still be linked and followed up after a permit change', async () => {
  const { dir } = await storeWithCheckAfterPermitChange();
  await refreshInspections({ client: client([permit('2')], [row('2', '2026-11-01', '08A')]), dir });
  await updateDb((db) => { db.internalChecks.k2 = { id: 'k2', locationId: 'union-square', date: '2026-11-02', type: 'Audit', source: 'Fictional demo check', note: 'Fictional.', citationCode: '08A' }; }, dir);
  const linked = await setCheckLink('k2', { decision: 'linked' }, { dir });
  assert.match(linked.link.citationId, /--08A$/, 'the explicit code resolves to the new permit’s citation');
  const followUp = await createFollowUp({ locationId: 'union-square', citationId: linked.link.citationId, owner: 'Manager', dueDate: '2026-12-03', notes: 'Act on the current finding.' }, { dir });
  assert.equal(followUp.status, 'Open');
});

test('a change in capitalization or abbreviation is not a new address', async () => {
  const { dir } = await storeWithFollowUp();
  await updateDb((db) => { db.locations['union-square'].confirmedByManager = true; }, dir);
  const same = { ...snapshot, locations: [{ ...snapshot.locations[0], street: '870 BROADWAY' }] };
  await syncDirectory({ snapshot: same, dir });
  const stored = (await readDb(dir)).locations['union-square'];
  assert.deepEqual([stored.matchStatus, stored.camis, stored.confirmedByManager], ['verified', '1', true]);
});
