import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { matchLocationsToCity, refreshInspections, syncDirectory } from '../lib/server/importer.js';
import { getLocationDetail } from '../lib/server/service.js';
import { readDb } from '../lib/server/store.js';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ImportWarning from '../components/ImportWarning.js';

const listing = (id, street, zip) => ({ id, name: `Sweetgreen ${id}`, street, zip, address: `${street}, New York, NY ${zip}`, sourceUrl: 'u' });
const snapshot = { fetchedAt: '2026-11-09T12:00:00.000Z', sourceUrl: 'u', locations: [listing('a', '870 Broadway', '10003'), listing('b', '50 Washington St', '11201')] };
const establishments = [
  { camis: '1', dba: 'SWEETGREEN', building: '870', street: 'BROADWAY', zipcode: '10003', latitude: '40.73', longitude: '-73.99' },
  { camis: '2', dba: 'SWEETGREEN', building: '50', street: 'WASHINGTON STREET', zipcode: '11201', latitude: '40.70', longitude: '-73.99' },
];
const row = (camis) => ({ camis, inspection_date: '2026-09-18T00:00:00.000', inspection_type: 'Cycle', violation_code: '06D', violation_description: 'Surface', critical_flag: 'Critical' });
const client = (rows) => ({ findSweetgreenEstablishments: async () => establishments, findEstablishmentsAtAddress: async () => [], fetchInspectionRows: async () => rows });

const first = new Date('2026-11-09T12:00:00Z');
const later = new Date('2026-11-10T12:00:00Z');

async function matchedStore() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'fsf-empty-'));
  await syncDirectory({ snapshot, dir });
  await matchLocationsToCity({ client: client([]), dir });
  return dir;
}

async function importedStore() {
  const dir = await matchedStore();
  await refreshInspections({ client: client([row('1'), row('2')]), dir, now: first });
  return dir;
}

test('the shared screen banner renders a partial-import warning and clears after recovery', async () => {
  const dir = await importedStore();
  await refreshInspections({ client: client([row('2')]), dir, now: later });
  const detail = await getLocationDetail('a', { dir });
  const render = (status) => renderToStaticMarkup(createElement(ImportWarning, { status }));
  const banner = render(detail.importStatus);
  assert.match(banner, /role="status"/);
  assert.match(banner, /Some locations were not refreshed/);
  assert.ok(banner.includes(detail.importStatus.warning));
  assert.match(banner, /earlier location refresh date/);
  assert.equal(detail.location.lastRefreshed, first.toISOString());
  await refreshInspections({ client: client([row('1'), row('2')]), dir, now: later });
  assert.equal(render((await getLocationDetail('a', { dir })).importStatus), '');
  assert.equal(render(undefined), '');
});

test('when the city returns nothing for one permit that has stored records, those records stay and the refresh says so', async () => {
  const dir = await importedStore();
  const before = (await readDb(dir)).inspections.a;
  assert.equal(before.length, 1);

  const result = await refreshInspections({ client: client([row('2')]), dir, now: later });

  assert.equal(result.ok, true);
  assert.deepEqual(result.keptUnchanged, ['a']);
  const db = await readDb(dir);
  assert.deepEqual(db.inspections.a, before, 'the stored findings were not erased');
  assert.equal(db.locations.a.lastRefreshed, first.toISOString(), 'and a was not marked as checked again');
  assert.equal(db.locations.b.lastRefreshed, later.toISOString(), 'the other location refreshed normally');
  assert.match(db.importStatus.warning, /a/);
  assert.equal(db.importStatus.error, null);
  assert.equal(db.importStatus.lastSuccess, later.toISOString());

  const detail = await getLocationDetail('a', { dir, now: later });
  assert.equal(detail.location.dataState, 'records');
  assert.match(detail.importStatus.warning, /a/, 'the API shows the warning');
});

test('when the city returns nothing for every permit that has stored records, the refresh fails and changes nothing', async () => {
  const dir = await importedStore();
  const before = await readDb(dir);

  const result = await refreshInspections({ client: client([]), dir, now: later });

  assert.equal(result.ok, false);
  assert.match(result.error, /no records/i);
  const db = await readDb(dir);
  assert.deepEqual(db.inspections, before.inspections);
  assert.equal(db.importStatus.lastSuccess, first.toISOString(), 'no success was recorded');
  assert.equal(db.importStatus.lastAttempt, later.toISOString());
  assert.match(db.importStatus.error, /no records/i);
  assert.equal((await getLocationDetail('a', { dir })).location.dataState, 'records');
});

test('the warning clears on the next refresh that finds every permit', async () => {
  const dir = await importedStore();
  await refreshInspections({ client: client([row('2')]), dir, now: later });
  assert.ok((await readDb(dir)).importStatus.warning);
  await refreshInspections({ client: client([row('1'), row('2')]), dir, now: new Date('2026-11-11T12:00:00Z') });
  assert.equal((await readDb(dir)).importStatus.warning, null);
});

test('a verified permit with no stored records and no city rows is an ordinary result, not a warning', async () => {
  const dir = await matchedStore();
  const result = await refreshInspections({ client: client([row('2')]), dir, now: first });
  assert.deepEqual(result, { ok: true, locations: 2, inspections: 1, citations: 1 });
  const db = await readDb(dir);
  assert.equal(db.importStatus.warning ?? null, null);
  assert.equal((await getLocationDetail('a', { dir })).location.dataState, 'no-records');
});
