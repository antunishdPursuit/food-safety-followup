import test from 'node:test';
import assert from 'node:assert/strict';
import { createNycClient, groupInspections } from '../lib/server/nyc.js';

const reply = (status, body) => async () => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const noWait = async () => {};

test('temporary failures are retried, then the request succeeds', async () => {
  const calls = [];
  const answers = [reply(503, {}), reply(429, {}), reply(200, [{ camis: '1' }])];
  const client = createNycClient({ fetchImpl: async (...args) => { calls.push(args); return answers[calls.length - 1](); }, wait: noWait });
  const rows = await client.fetchInspectionRows(['1']);
  assert.equal(rows.length, 1);
  assert.equal(calls.length, 3);
});

test('a network error is retried and finally reported as one clear error', async () => {
  let calls = 0;
  const client = createNycClient({ fetchImpl: async () => { calls += 1; throw new Error('socket hang up'); }, wait: noWait, attempts: 3 });
  await assert.rejects(client.fetchInspectionRows(['1']), /NYC Open Data request failed\. socket hang up/);
  assert.equal(calls, 3);
});

test('a client error such as a bad request is not retried', async () => {
  let calls = 0;
  const client = createNycClient({ fetchImpl: async () => { calls += 1; return reply(400, {})(); }, wait: noWait });
  await assert.rejects(client.fetchInspectionRows(['1']), /returned 400/);
  assert.equal(calls, 1);
});

test('an unexpected response body is an error, not an empty result', async () => {
  const client = createNycClient({ fetchImpl: reply(200, { message: 'Service unavailable' }), wait: noWait });
  await assert.rejects(client.fetchInspectionRows(['1']), /unexpected response/);
});

test('the app token is sent when configured, and only digits are accepted as CAMIS IDs', async () => {
  const headers = [];
  const client = createNycClient({ appToken: 'token-123', fetchImpl: async (url, init) => { headers.push(init.headers['x-app-token']); return reply(200, [])(); }, wait: noWait });
  await client.fetchInspectionRows(['1']);
  assert.deepEqual(headers, ['token-123']);
  await assert.rejects(client.fetchInspectionRows(["1' OR '1'='1"]), /digits only/);
});

test('large results are read page by page', async () => {
  const pages = [Array.from({ length: 5000 }, (_, index) => ({ camis: String(index) })), [{ camis: 'last' }]];
  let call = 0;
  const client = createNycClient({ fetchImpl: async () => reply(200, pages[call++])(), wait: noWait });
  assert.equal((await client.fetchInspectionRows(['1'])).length, 5001);
});

test('the name lookup asks for each permit’s phone number so it can be compared with the location page', async () => {
  let asked = '';
  const client = createNycClient({ fetchImpl: async (url) => { asked = String(url); return reply(200, [])(); }, wait: noWait });
  await client.findSweetgreenEstablishments();
  assert.match(decodeURIComponent(asked), /\$select=[^&]*\bphone\b/);
});

test('one establishment per CAMIS is kept, using its most recent record', async () => {
  const rows = [
    { camis: '1', dba: 'SWEETGREEN', building: '870', record_date: '2026-11-01' },
    { camis: '1', dba: 'SWEETGREEN', building: '870', record_date: '2026-09-01' },
    { camis: '2', dba: 'SWEETGREEN', building: '12', record_date: '2026-10-01' },
  ];
  const client = createNycClient({ fetchImpl: reply(200, rows), wait: noWait });
  const found = await client.findSweetgreenEstablishments();
  assert.equal(found.length, 2);
  assert.equal(found.find((item) => item.camis === '1').record_date, '2026-11-01');
});

const row = (fields) => ({ camis: '50001', inspection_type: 'Cycle Inspection / Initial Inspection', critical_flag: 'Critical', ...fields });

test('several citation rows become one inspection with a stable id', () => {
  const rows = [
    row({ inspection_date: '2026-09-18T00:00:00.000', violation_code: '06D', violation_description: 'Food contact surface not sanitized', score: '12', grade: 'A' }),
    row({ inspection_date: '2026-09-18T00:00:00.000', violation_code: '10F', violation_description: 'Equipment finding', critical_flag: 'Not Critical', score: '12', grade: 'A' }),
  ];
  const [inspection] = groupInspections(rows);
  assert.equal(inspection.id, 'i-50001-20260918-cycle-inspection-initial-inspection');
  assert.equal(inspection.outcome, 'citations');
  assert.equal(inspection.result, '2 citations recorded');
  assert.equal(inspection.score, 12);
  assert.deepEqual(inspection.citations.map((item) => [item.code, item.critical]), [['06D', true], ['10F', false]]);
  assert.equal(groupInspections(rows)[0].citations[0].id, inspection.citations[0].id);
});

test('no-violation, not-yet-inspected, and unstated results stay distinct', () => {
  // Newest first; a record with no date sorts last.
  const [none, unknown, never] = groupInspections([
    row({ inspection_date: '2026-10-01T00:00:00.000', action: 'No violations were recorded at the time of this inspection.', critical_flag: 'Not Applicable' }),
    row({ inspection_date: '1900-01-01T00:00:00.000', inspection_type: undefined, critical_flag: 'Not Applicable' }),
    row({ inspection_date: '2026-08-01T00:00:00.000', critical_flag: 'Not Applicable' }),
  ]);
  assert.equal(none.outcome, 'no-violations');
  assert.equal(never.outcome, 'not-yet-inspected');
  assert.equal(never.date, null);
  assert.equal(unknown.outcome, 'unknown');
  assert.match(unknown.result, /not stated/);
});

test('exact duplicate rows collapse, but two different findings with one code are both kept', () => {
  const base = { inspection_date: '2026-09-18T00:00:00.000', violation_code: '04L' };
  const [inspection] = groupInspections([
    row({ ...base, violation_description: 'Mice present' }),
    row({ ...base, violation_description: 'Mice present' }),
    row({ ...base, violation_description: 'Mice droppings in storage' }),
  ]);
  assert.equal(inspection.citations.length, 2);
  assert.notEqual(inspection.citations[0].id, inspection.citations[1].id);
});

test('the same code on different dates produces separate citations', () => {
  const inspections = groupInspections([
    row({ inspection_date: '2026-09-18T00:00:00.000', violation_code: '06D', violation_description: 'x' }),
    row({ inspection_date: '2026-10-08T00:00:00.000', violation_code: '06D', violation_description: 'x' }),
  ]);
  assert.deepEqual(inspections.map((item) => item.date), ['2026-10-08', '2026-09-18']);
  assert.notEqual(inspections[0].citations[0].id, inspections[1].citations[0].id);
});
