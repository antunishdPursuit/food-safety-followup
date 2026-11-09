import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { seedSample } from '../lib/server/sample.js';
import { readDb, updateDb } from '../lib/server/store.js';

async function routes() {
  process.env.FSF_DATA_DIR = await fs.mkdtemp(path.join(os.tmpdir(), 'fsf-write-'));
  await seedSample({ dir: process.env.FSF_DATA_DIR });
  const { POST } = await import('../app/api/follow-ups/route.js');
  const { PATCH } = await import('../app/api/follow-ups/[id]/route.js');
  const { PUT } = await import('../app/api/internal-checks/[id]/link/route.js');
  const { GET: detailRoute } = await import('../app/api/locations/[id]/route.js');
  const send = async (handler, method, url, body, params, headers = { 'content-type': 'application/json' }) => {
    const request = new Request(`http://x${url}`, { method, headers, body: typeof body === 'string' ? body : JSON.stringify(body) });
    const response = await handler(request, { params: Promise.resolve(params || {}) });
    return { status: response.status, body: await response.json() };
  };
  const detail = async (id = 'sample-midtown') => (await detailRoute(new Request('http://x'), { params: Promise.resolve({ id }) })).json();
  return {
    create: (body, extra) => send(POST, 'POST', '/api/follow-ups', body, {}, extra),
    update: (id, body) => send(PATCH, 'PATCH', `/api/follow-ups/${id}`, body, { id }),
    link: (id, body) => send(PUT, 'PUT', `/api/internal-checks/${id}/link`, body, { id }),
    send, POST, PATCH, PUT, detail,
  };
}

const valid = { locationId: 'sample-midtown', citationId: 'citation-1', owner: 'Manager', dueDate: '2026-12-01', notes: 'Re-clean and verify.' };

test('POST /api/follow-ups saves a follow-up, returns the saved record, and it survives a fresh read', async () => {
  const { create, detail } = await routes();
  const { status, body } = await create(valid);
  assert.equal(status, 201);
  assert.match(body.id, /^fu-/);
  assert.deepEqual([body.status, body.completionNote, body.completedAt, body.source], ['Open', '', null, 'Prototype follow-up']);
  assert.equal(body.history.length, 1);
  const after = await detail();
  assert.ok(after.followUps.some((item) => item.id === body.id && item.owner === 'Manager'));
  assert.ok(!after.flags.some((flag) => flag.id === 'unlinked-citation-1'), 'the citation is now linked to a follow-up');
});

test('a follow-up can link to a citation, a demo check, or both, and needs at least one', async () => {
  const { create } = await routes();
  const both = await create({ ...valid, checkId: 'check-1' });
  assert.equal(both.status, 201);
  assert.deepEqual([both.body.citationId, both.body.checkId], ['citation-1', 'check-1']);
  const checkOnly = await create({ ...valid, citationId: undefined, checkId: 'check-2' });
  assert.deepEqual([checkOnly.status, checkOnly.body.citationId], [201, null]);
  const neither = await create({ ...valid, citationId: undefined });
  assert.equal(neither.status, 422);
  assert.equal(neither.body.error.fields.finding, 'Choose a finding.');
});

test('invalid input is rejected with field messages and saves nothing', async () => {
  const { create, detail } = await routes();
  const before = (await detail()).followUps.length;
  const empty = await create({ locationId: 'sample-midtown', citationId: 'citation-1' });
  assert.equal(empty.status, 422);
  assert.equal(empty.body.error.code, 'validation_failed');
  assert.deepEqual(Object.keys(empty.body.error.fields).sort(), ['dueDate', 'notes', 'owner']);
  assert.equal((await create({ ...valid, dueDate: '2026-02-30' })).body.error.fields.dueDate, 'Use a real date in YYYY-MM-DD form.');
  assert.equal((await create({ ...valid, dueDate: 'tomorrow' })).status, 422);
  assert.equal((await create({ ...valid, status: 'Done' })).body.error.fields.status, 'Choose Open, In progress, or Complete.');
  assert.equal((await create({ ...valid, status: 'Complete' })).body.error.fields.completionNote, 'Add a completion note.');
  assert.equal((await create({ ...valid, owner: { name: 'x' } })).status, 422, 'a non-text owner is a 422, not a crash');
  assert.equal((await create({ ...valid, notes: 'x'.repeat(2001) })).status, 422);
  assert.equal((await create({ ...valid, citationId: 'citation-99' })).body.error.fields.citationId, 'This citation is not part of this location.');
  assert.equal((await create({ ...valid, checkId: 'nope' })).body.error.fields.checkId, 'This demo check is not part of this location.');
  assert.equal((await create({ ...valid, locationId: 'sample-queens' })).status, 422, 'a citation from another location cannot be linked');
  assert.equal((await create({ ...valid, locationId: 'nope' })).status, 404);
  assert.equal((await detail()).followUps.length, before);
});

test('requests that are not a JSON object are refused', async () => {
  const { create, send, POST } = await routes();
  assert.equal((await create('{not json')).status, 400);
  assert.equal((await create([valid])).status, 400);
  assert.equal((await create('null')).status, 400);
  const form = await send(POST, 'POST', '/api/follow-ups', 'owner=x', {}, { 'content-type': 'application/x-www-form-urlencoded' });
  assert.equal(form.status, 415);
  const big = await create(JSON.stringify({ ...valid, notes: 'x'.repeat(150000) }));
  assert.equal(big.status, 413);
});

test('PATCH updates fields and records status changes in the history', async () => {
  const { create, update } = await routes();
  const { body: made } = await create(valid);
  const progressed = await update(made.id, { status: 'In progress', owner: 'Kitchen lead', notes: 'Rescheduled the deep clean.' });
  assert.equal(progressed.status, 200);
  assert.deepEqual([progressed.body.status, progressed.body.owner], ['In progress', 'Kitchen lead']);
  assert.deepEqual(progressed.body.history.map((entry) => entry.status), ['Open', 'In progress']);
  assert.equal(progressed.body.citationId, 'citation-1');
  const same = await update(made.id, { notes: 'Edited again.' });
  assert.equal(same.body.history.length, 2, 'editing text is not a status change');
});

test('Complete needs a completion note; without one nothing changes', async () => {
  const { create, update, detail } = await routes();
  const { body: made } = await create(valid);
  const missing = await update(made.id, { status: 'Complete', completionNote: '  ' });
  assert.equal(missing.status, 422);
  assert.equal(missing.body.error.fields.completionNote, 'Add a completion note.');
  assert.equal((await detail()).followUps.find((item) => item.id === made.id).status, 'Open');
  const done = await update(made.id, { status: 'Complete', completionNote: 'Verified on site.' });
  assert.equal(done.body.status, 'Complete');
  assert.equal(done.body.completionNote, 'Verified on site.');
  assert.ok(done.body.completedAt);
  assert.equal(done.body.history.at(-1).note, 'Verified on site.');
  assert.equal(done.body.overdue, false);
});

test('reopening a completed follow-up clears the completion but keeps the history', async () => {
  const { create, update } = await routes();
  const { body: made } = await create(valid);
  await update(made.id, { status: 'Complete', completionNote: 'Verified on site.' });
  const reopened = await update(made.id, { status: 'Open' });
  assert.deepEqual([reopened.body.status, reopened.body.completionNote, reopened.body.completedAt], ['Open', '', null]);
  assert.deepEqual(reopened.body.history.map((entry) => entry.status), ['Open', 'Complete', 'Open']);
});

test('the linked finding cannot be changed, and an unknown follow-up is a 404', async () => {
  const { create, update } = await routes();
  const { body: made } = await create(valid);
  const moved = await update(made.id, { citationId: 'citation-3' });
  assert.equal(moved.status, 422);
  assert.match(moved.body.error.fields.citationId, /cannot be changed/);
  assert.equal((await update(made.id, { citationId: 'citation-1', owner: 'Same link is fine' })).status, 200);
  for (const id of ['nope', '__proto__']) assert.equal((await update(id, { owner: 'x' })).status, 404, id);
});

test('follow-up edits never alter the imported inspection records', async () => {
  const { create, update, detail } = await routes();
  const before = (await detail()).inspections;
  const { body: made } = await create(valid);
  await update(made.id, { status: 'Complete', completionNote: 'Done.', inspections: [], code: '99Z', citations: [] });
  assert.deepEqual((await detail()).inspections, before);
});

test('linking a demo check to a citation, or dismissing the suggestion, is saved and shown on the flags', async () => {
  const { link, detail } = await routes();
  const linked = await link('check-1', { decision: 'linked' });
  assert.equal(linked.status, 200);
  assert.deepEqual([linked.body.link.decision, linked.body.link.citationId], ['linked', 'citation-1']);
  assert.ok((await detail()).flags.find((flag) => flag.id === 'unlinked-citation-1').checkIds.includes('check-1'));

  const dismissed = await link('check-1', { decision: 'dismissed' });
  assert.equal(dismissed.body.link.decision, 'dismissed');
  const after = await detail();
  assert.deepEqual(after.flags.find((flag) => flag.id === 'unlinked-citation-1').checkIds, []);
  assert.equal(after.internalChecks.find((item) => item.id === 'check-1').link.decision, 'dismissed');
});

test('the manager can link a check that has no suggestion to any citation at the location', async () => {
  const { link } = await routes();
  assert.equal((await link('check-2', { decision: 'linked' })).status, 422, 'no suggestion and no citation chosen');
  const chosen = await link('check-2', { decision: 'linked', citationId: 'citation-2' });
  assert.equal(chosen.status, 200);
  assert.equal(chosen.body.link.citationId, 'citation-2');
  assert.equal((await link('check-2', { decision: 'linked', citationId: 'citation-99' })).status, 422);
  assert.equal((await link('check-2', { decision: 'maybe' })).body.error.fields.decision, 'Choose linked or dismissed.');
  assert.equal((await link('nope', { decision: 'dismissed' })).status, 404);
});

test('dismissals validate explicit citation ids and leave invalid decisions unsaved', async () => {
  const { link } = await routes();
  const dir = process.env.FSF_DATA_DIR;
  await updateDb((db) => {
    db.internalChecks['other-check'] = { id: 'other-check', locationId: 'sample-queens', type: 'Audit', date: '2026-11-01', note: 'Fictional check.', source: 'Fictional demo check' };
  }, dir);
  const before = (await readDb(dir)).links;
  for (const [checkId, citationId] of [['check-1', 'missing-citation'], ['other-check', 'citation-1']]) {
    const response = await link(checkId, { decision: 'dismissed', citationId });
    assert.equal(response.status, 422);
    assert.equal(response.body.error.fields.citationId, 'This citation is not part of this location.');
    assert.deepEqual((await readDb(dir)).links, before);
  }
  const validDismissal = await link('check-1', { decision: 'dismissed', citationId: 'citation-1' });
  assert.equal(validDismissal.status, 200);
  assert.equal(validDismissal.body.link.citationId, 'citation-1');
  assert.equal((await link('other-check', { decision: 'dismissed' })).body.link.citationId, null);
});

test('JSON lookalike media types are rejected, while JSON with a charset remains supported', async () => {
  const { create } = await routes();
  for (const contentType of ['text/plain; foo=application/json', 'application/jsonp', 'application/json-malicious', 'application/x-www-form-urlencoded; foo=application/json']) {
    assert.equal((await create(valid, { 'content-type': contentType })).status, 415, contentType);
  }
  assert.equal((await create(valid, { 'content-type': 'Application/JSON; charset=utf-8' })).status, 201);
});

test('foreign and opaque browser origins cannot create, edit or dismiss records', async () => {
  const { create, send, POST, PATCH, PUT } = await routes();
  const made = await create(valid);
  const dir = process.env.FSF_DATA_DIR;
  const before = await readDb(dir);
  for (const origin of ['https://other.example', 'null', 'https://x', 'http://x:3000']) {
    const headers = { 'content-type': 'application/json', origin };
    for (const [handler, method, url, body, params] of [
      [POST, 'POST', '/api/follow-ups', valid, {}],
      [PATCH, 'PATCH', `/api/follow-ups/${made.body.id}`, { notes: 'Unwanted edit.' }, { id: made.body.id }],
      [PUT, 'PUT', '/api/internal-checks/check-1/link', { decision: 'dismissed' }, { id: 'check-1' }],
    ]) assert.equal((await send(handler, method, url, body, params, headers)).status, 403);
    assert.deepEqual(await readDb(dir), before);
  }
  assert.equal((await create(valid, { 'content-type': 'application/json', 'sec-fetch-site': 'cross-site' })).status, 403);
  assert.deepEqual(await readDb(dir), before);
  assert.equal((await create(valid, { 'content-type': 'application/json', origin: 'http://x' })).status, 201);
  assert.equal((await create(valid, { 'content-type': 'application/json', host: '127.0.0.1:3000', origin: 'http://127.0.0.1:3000' })).status, 201);
  assert.equal((await create(valid, { 'content-type': 'application/json', host: '127.0.0.1:3000', origin: 'http://x' })).status, 403);
});

test('simultaneous requests all save with distinct ids', async () => {
  const { create, detail } = await routes();
  const results = await Promise.all(Array.from({ length: 12 }, (_, index) => create({ ...valid, notes: `Action ${index}` })));
  assert.ok(results.every((result) => result.status === 201));
  assert.equal(new Set(results.map((result) => result.body.id)).size, 12);
  assert.equal((await detail()).followUps.length, 13);
});
