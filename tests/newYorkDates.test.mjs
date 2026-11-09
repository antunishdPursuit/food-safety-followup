import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as dates from '../lib/followUps.js';
import { getLocationDetail, listLocations, monthsAgo } from '../lib/server/service.js';
import { updateDb } from '../lib/server/store.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const followUps = pathToFileURL(path.join(root, 'lib', 'followUps.js')).href;
const due = (dueDate) => ({ status: 'Open', dueDate });
const at = (iso) => new Date(iso);

// "Today" is a New York calendar date wherever the code runs. A server set to UTC would otherwise call a follow-up that is
// due today overdue from 19:00 in New York (20:00 in summer), and a browser in another zone would disagree with the server.
test('a follow-up due today is overdue only after midnight in New York, whatever zone the server is set to', () => {
  const probe = `
    import { isOverdue } from '${followUps}';
    const action = { status: 'Open', dueDate: '2026-11-09' };
    console.log(JSON.stringify(['2026-11-10T01:00:00Z', '2026-11-10T04:59:59Z', '2026-11-10T05:00:00Z'].map((iso) => isOverdue(action, new Date(iso)))));
  `;
  for (const zone of ['UTC', 'Pacific/Auckland', 'Asia/Tokyo', 'America/Los_Angeles', 'America/New_York']) {
    const run = spawnSync(process.execPath, ['--input-type=module', '-e', probe], { env: { ...process.env, TZ: zone }, encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr);
    assert.deepEqual(JSON.parse(run.stdout), [false, false, true], `in zone ${zone}: 20:00 and 23:59:59 on the due date are not overdue; 00:00 the next day is`);
  }
});

test('the New York date follows daylight saving time at both clock changes', () => {
  // Spring forward on 2026-03-08 and fall back on 2026-11-01.
  assert.equal(dates.isOverdue(due('2026-03-08'), at('2026-03-09T03:59:59Z')), false);
  assert.equal(dates.isOverdue(due('2026-03-08'), at('2026-03-09T04:00:00Z')), true);
  assert.equal(dates.isOverdue(due('2026-11-01'), at('2026-11-02T04:59:59Z')), false);
  assert.equal(dates.isOverdue(due('2026-11-01'), at('2026-11-02T05:00:00Z')), true);
});

test('finished actions and actions with no due date are never overdue', () => {
  assert.equal(dates.isOverdue({ status: 'Complete', dueDate: '2026-01-01' }, at('2026-11-10T05:00:00Z')), false);
  assert.equal(dates.isOverdue({ status: 'Open', dueDate: '' }, at('2026-11-10T05:00:00Z')), false);
});

test('newYorkDate gives the calendar date in New York, across a year boundary', () => {
  assert.equal(dates.newYorkDate(at('2026-12-31T20:00:00Z')), '2026-12-31');
  assert.equal(dates.newYorkDate(at('2027-01-01T04:59:59Z')), '2026-12-31');
  assert.equal(dates.newYorkDate(at('2027-01-01T05:00:00Z')), '2027-01-01');
});

test('the regional window counts back from the New York date, not the UTC date', () => {
  // 22:00 on 30 April in New York is already 1 May in UTC.
  assert.equal(monthsAgo(at('2026-05-01T02:00:00Z'), 1), '2026-03-30');
  assert.equal(monthsAgo(at('2026-05-01T12:00:00Z'), 1), '2026-04-01');
  // 20:00 on 31 March in New York is 1 April in UTC; one month back clamps to the end of February.
  assert.equal(monthsAgo(at('2026-04-01T00:00:00Z'), 1), '2026-02-28');
});

test('the API reports a follow-up due today as overdue only after midnight in New York', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'fsf-nydates-'));
  await updateDb((db) => {
    db.locations.a = { id: 'a', name: 'Sweetgreen a', address: 'a', street: '870 Broadway', zip: '10003', camis: '1', matchStatus: 'verified', candidates: [], lastRefreshed: '2026-11-01T00:00:00.000Z', delisted: false };
    db.followUps['fu-1'] = { id: 'fu-1', locationId: 'a', citationId: null, checkId: 'c1', owner: 'Manager', dueDate: '2026-11-09', notes: 'Re-check.', status: 'Open', completionNote: '', completedAt: null, createdAt: '2026-11-01T00:00:00.000Z', updatedAt: '2026-11-01T00:00:00.000Z', history: [] };
  }, dir);
  const evening = at('2026-11-10T01:00:00Z');
  const nextDay = at('2026-11-10T05:00:00Z');
  const hostZone = process.env.TZ;
  process.env.TZ = 'UTC'; // the zone of most servers and of hosted checks
  try {
    assert.equal((await listLocations({ dir, now: evening })).locations[0].overdueFollowUpCount, 0);
    assert.equal((await getLocationDetail('a', { dir, now: evening })).followUps[0].overdue, false);
    assert.equal((await listLocations({ dir, now: nextDay })).locations[0].overdueFollowUpCount, 1);
    assert.equal((await getLocationDetail('a', { dir, now: nextDay })).followUps[0].overdue, true);
  } finally {
    if (hostZone === undefined) delete process.env.TZ; else process.env.TZ = hostZone;
  }
});
