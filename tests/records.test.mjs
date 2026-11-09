import test from 'node:test';
import assert from 'node:assert/strict';
import { citationsFor, reviewGroups } from '../lib/records.js';

test('review grouping keeps every API flag and its supporting IDs, grouping only findings on one inspection', () => {
  const flags = [
    { id: 'a', type: 'Needs review', citationIds: ['c1'] },
    { id: 'b', type: 'Needs review', citationIds: ['c2'] },
    { id: 'r', type: 'Repeat code', citationIds: ['c1', 'c3'] },
    { id: 'd', type: 'Needs review', citationIds: ['c3'] },
    { id: 'missing', type: 'Needs review', citationIds: ['missing'] },
  ];
  const detail = { flags, inspections: [
    { id: 'i1', date: '2026-10-01', citations: [{ id: 'c1' }, { id: 'c2' }] },
    { id: 'i2', date: '2026-09-01', citations: [{ id: 'c3' }] },
  ] };
  const groups = reviewGroups(detail);
  assert.deepEqual(groups.map((group) => group.flags.length), [2, 1, 1, 1]);
  assert.deepEqual(groups.flatMap((group) => group.flags).map((flag) => flag.id).sort(), flags.map((flag) => flag.id).sort());
  assert.equal(groups[0].flags[0], flags[0]);
});

test('presentation marks removed findings and prior permits as history without changing the source records', () => {
  const detail = { inspections: [
    { id: 'i1', sourceUrl: 'https://example.org', citations: [{ id: 'active' }, { id: 'removed', removedFromSource: true }] },
    { id: 'i2', previousPermit: true, citations: [{ id: 'old' }] },
    { id: 'i3', removedFromSource: true, citations: [{ id: 'gone' }] },
  ] };
  const records = citationsFor(detail);
  assert.deepEqual(records.map((record) => record.historical), [false, true, true, true]);
  assert.equal(records[0].sourceUrl, 'https://example.org');
  assert.equal(detail.inspections[0].citations[0].historical, undefined);
});
