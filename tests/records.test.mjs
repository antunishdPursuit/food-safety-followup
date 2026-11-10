import test from 'node:test';
import assert from 'node:assert/strict';
import { citationsFor, comparisonChecks, nextActionCitation, reviewGroups, checkReviewTarget, savedRecordFlag } from '../lib/records.js';

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

test('comparison uses the saved link target when it differs from a current suggestion', () => {
  const detail = { internalChecks: [
    { id: 'linked', suggestedCitationId: 'new', link: { decision: 'linked', citationId: 'old' } },
    { id: 'dismissed', suggestedCitationId: 'new', link: { decision: 'dismissed' } },
    { id: 'suggested', suggestedCitationId: 'new', link: null },
  ] };
  assert.deepEqual(comparisonChecks(detail, [{ id: 'old' }]).map((check) => check.id), ['linked']);
  assert.deepEqual(comparisonChecks(detail, [{ id: 'new' }]).map((check) => check.id), ['linked', 'dismissed', 'suggested']);
  assert.deepEqual(comparisonChecks(detail, []), []);
});

test('repeat comparison offers an unlinked current finding before an older finding with saved work', () => {
  const supporting = [{ id: 'old', historical: false }, { id: 'new', historical: false }, { id: 'history', historical: true }];
  assert.equal(nextActionCitation(supporting, [{ citationId: 'old' }]).id, 'new');
  assert.equal(nextActionCitation(supporting.slice(2), []), undefined);
});

test('saved links do not duplicate an active API flag and remain reviewable as history', () => {
  const detail = { flags: [{ id: 'unlinked-c1' }], followUps: [], internalChecks: [{ link: { decision: 'linked', citationId: 'c1' } }], inspections: [{ id: 'i1', citations: [{ id: 'c1' }] }] };
  assert.equal(savedRecordFlag(detail, 'unlinked-c1'), null);
  detail.flags = [];
  assert.equal(savedRecordFlag(detail, 'unlinked-c1').citationIds[0], 'c1');
  assert.equal(savedRecordFlag(detail, 'unlinked-missing'), null);
  detail.internalChecks[0].link.decision = 'dismissed';
  assert.equal(savedRecordFlag(detail, 'unlinked-c1'), null);
  assert.equal(checkReviewTarget(detail.internalChecks[0]), undefined, 'no broken URL for a dismissed historical suggestion');
  detail.followUps.push({ citationId: 'c1' });
  assert.equal(savedRecordFlag(detail, 'unlinked-c1').citationIds[0], 'c1');
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
