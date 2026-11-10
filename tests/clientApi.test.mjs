import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createApiClient, ApiRequestError } from '../lib/api.js';
import { seedSample } from '../lib/server/sample.js';
import { GET as list } from '../app/api/locations/route.js';
import { GET as detail } from '../app/api/locations/[id]/route.js';
import { POST } from '../app/api/follow-ups/route.js';
import { PATCH } from '../app/api/follow-ups/[id]/route.js';
import { PUT } from '../app/api/internal-checks/[id]/link/route.js';

test('frontend client loads API records and persists creation, edits, completion and link decisions across fresh reads', async () => {
  process.env.FSF_DATA_DIR = await mkdtemp(path.join(os.tmpdir(), 'fsf-client-'));
  await seedSample({ dir: process.env.FSF_DATA_DIR });
  const dispatch = async (url, options) => {
    const request = new Request('http://localhost' + url, options);
    const pathname = new URL(request.url).pathname;
    assert.equal(options.cache, 'no-store');
    if (options.method !== 'GET') assert.equal(request.headers.get('content-type'), 'application/json');
    if (pathname === '/api/locations') return list(request);
    if (pathname === '/api/follow-ups') return POST(request);
    const id = decodeURIComponent(pathname.split('/')[3]);
    const context = { params: Promise.resolve({ id }) };
    if (pathname.startsWith('/api/locations/')) {
      assert.equal(new URL(request.url).searchParams.get('regionalMonths'), '12');
      return detail(request, context);
    }
    return pathname.startsWith('/api/follow-ups/') ? PATCH(request, context) : PUT(request, context);
  };
  const client = createApiClient(dispatch);
  assert.equal((await client.locations()).locations.length, 3);
  assert.ok((await client.location('sample-midtown')).flags.some((flag) => flag.id === 'unlinked-citation-1'));
  const action = await client.saveFollowUp({ locationId: 'sample-midtown', citationId: 'citation-1', owner: 'Test manager', dueDate: '2026-12-01', notes: 'Verify cleaning.', status: 'Open' });
  assert.ok((await createApiClient(dispatch).location('sample-midtown')).followUps.some((item) => item.id === action.id));
  assert.ok(!(await client.location('sample-midtown')).flags.some((flag) => flag.id === 'unlinked-citation-1'));
  const edited = await client.saveFollowUp({ ...action, owner: 'Shift lead', status: 'In progress' }, action.id);
  assert.equal(edited.owner, 'Shift lead');
  await assert.rejects(client.saveFollowUp({ status: 'Complete', completionNote: '' }, action.id), (error) => error instanceof ApiRequestError && Boolean(error.fields.completionNote));
  await client.saveFollowUp({ status: 'Complete', completionNote: 'Verified on site.' }, action.id);
  const saved = (await createApiClient(dispatch).location('sample-midtown')).followUps.find((item) => item.id === action.id);
  assert.equal(saved.status, 'Complete');
  assert.equal(saved.completionNote, 'Verified on site.');
  await client.setCheckLink('check-1', 'linked', 'citation-1');
  assert.equal((await client.location('sample-midtown')).internalChecks.find((check) => check.id === 'check-1').link.decision, 'linked');
  await client.setCheckLink('check-1', 'dismissed');
  assert.equal((await client.location('sample-midtown')).internalChecks.find((check) => check.id === 'check-1').link.decision, 'dismissed');
  await assert.rejects(client.location('missing'), (error) => error.status === 404);
  assert.equal((await client.locations()).locations.find((item) => item.id === 'sample-midtown').openFollowUpCount, 1);
});

test('client preserves abort, network and unreadable response failures rather than reporting a save', async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(createApiClient((url, options) => { assert.equal(options.signal, controller.signal); throw new DOMException('Aborted', 'AbortError'); }).locations(controller.signal), { name: 'AbortError' });
  await assert.rejects(createApiClient(() => { throw new TypeError('Network unavailable'); }).locations(), /Network unavailable/);
  await assert.rejects(createApiClient(() => new Response('<html>error</html>')).locations(), /unreadable response/);
  await assert.rejects(createApiClient(() => new Response('failure', { status: 503 })).locations(), (error) => error.status === 503);
});
