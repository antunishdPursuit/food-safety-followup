import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { matchLocationsToCity, refreshInspections, syncDirectory } from '../lib/server/importer.js';
import { getLocationDetail } from '../lib/server/service.js';

const listing = (id, street, zip) => ({ id, name: `Sweetgreen ${id}`, street, zip, address: `${street}, New York, NY ${zip}`, sourceUrl: 'u' });
const snapshot = { fetchedAt: '2026-11-09T12:00:00.000Z', sourceUrl: 'u', locations: [listing('a', '870 Broadway', '10003'), listing('b', '50 Washington St', '11201')] };
const establishments = [
  { camis: '1', dba: 'SWEETGREEN', building: '870', street: 'BROADWAY', zipcode: '10003', latitude: '40.73', longitude: '-73.99' },
  { camis: '2', dba: 'SWEETGREEN', building: '50', street: 'WASHINGTON STREET', zipcode: '11201', latitude: '40.70', longitude: '-73.99' },
];
const row = (camis, date, code) => ({ camis, inspection_date: `${date}T00:00:00.000`, inspection_type: 'Cycle', violation_code: code, violation_description: `Finding ${code}`, critical_flag: 'Critical' });
const NOW = new Date('2026-11-09T18:00:00Z');

// Location a cites 06D recently and 10F recently. Location b cites 06D long ago (2024) and 10F recently.
async function store() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'fsf-window-'));
  const rows = [row('1', '2026-10-08', '06D'), row('1', '2026-09-01', '10F'), row('2', '2024-01-10', '06D'), row('2', '2026-10-01', '10F')];
  const client = { findSweetgreenEstablishments: async () => establishments, findEstablishmentsAtAddress: async () => [], fetchInspectionRows: async () => rows };
  await syncDirectory({ snapshot, dir });
  await matchLocationsToCity({ client, dir });
  await refreshInspections({ client, dir });
  return dir;
}
const codes = (detail) => detail.regionalSignals.map((signal) => signal.code).sort();

test('without the option, regional signals use every current inspection and the window is null', async () => {
  const dir = await store();
  const detail = await getLocationDetail('a', { dir, now: NOW });
  assert.deepEqual(codes(detail), ['06D', '10F']);
  assert.deepEqual(detail.regionalWindow, { months: null, since: null });
});

test('a 12-month window drops a code that another location last cited long ago', async () => {
  const dir = await store();
  const detail = await getLocationDetail('a', { dir, now: NOW, regionalMonths: '12' });
  assert.deepEqual(codes(detail), ['10F'], '06D at b is from 2024, outside the window');
  assert.deepEqual(detail.regionalWindow, { months: 12, since: '2025-11-09' });
  assert.equal(detail.regionalSignals[0].locationCount, 2);
  assert.equal(detail.flags.filter((flag) => flag.type === 'Needs review').length, 2, 'the location’s own flags ignore the window');
});

test('a wider window brings the older code back', async () => {
  const dir = await store();
  assert.deepEqual(codes(await getLocationDetail('a', { dir, now: NOW, regionalMonths: 36 })), ['06D', '10F']);
});

test('a window that is not a whole number from 1 to 120 is refused', async () => {
  const dir = await store();
  for (const bad of ['0', '121', 'abc', '1.5', '-3', '12 months']) {
    await assert.rejects(getLocationDetail('a', { dir, now: NOW, regionalMonths: bad }), (error) => error.status === 400 && error.code === 'invalid_query', bad);
  }
});

test('the detail route reads ?regionalMonths and rejects a bad value with a 400', async () => {
  process.env.FSF_DATA_DIR = await store();
  const { GET } = await import('../app/api/locations/[id]/route.js');
  const call = async (query) => {
    const response = await GET(new Request(`http://x/api/locations/a${query}`), { params: Promise.resolve({ id: 'a' }) });
    return { status: response.status, body: await response.json() };
  };
  const ok = await call('?regionalMonths=12');
  assert.equal(ok.status, 200);
  assert.equal(ok.body.regionalWindow.months, 12);
  assert.deepEqual((await call('')).body.regionalWindow, { months: null, since: null });
  const bad = await call('?regionalMonths=abc');
  assert.equal(bad.status, 400);
  assert.equal(bad.body.error.code, 'invalid_query');
});
