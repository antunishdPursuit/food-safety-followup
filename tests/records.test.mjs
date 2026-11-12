import test from 'node:test';
import assert from 'node:assert/strict';
import { citationsFor, comparisonChecks, nextActionCitation, reviewGroups, checkReviewTarget, savedRecordFlag, inspectionTimeline, inspectionNotice, locationFor } from '../lib/records.js';

test('inspection timeline preserves old source records and separates latest inspection from retained history', () => {
  const inspections = [
    { id: 'old', date: '2022-12-19', citations: [{ id: 'c1' }] },
    { id: 'previous-permit', date: '2026-09-01', previousPermit: true, citations: [] },
    { id: 'removed', date: '2026-10-01', removedFromSource: true, citations: [] },
    { id: 'latest', date: '2025-11-05', outcome: 'no-violations', citations: [] },
    { id: 'unknown', date: null, citations: [] },
  ];
  const before = structuredClone(inspections);
  const timeline = inspectionTimeline(inspections);
  assert.equal(timeline.latest.id, 'latest');
  assert.deepEqual(timeline.years.map((group) => group.year), ['2026', '2025', '2022', 'Date unavailable']);
  assert.equal(timeline.years.flatMap((group) => group.records).length, inspections.length);
  assert.equal(timeline.years[2].records[0].citations[0].id, 'c1');
  assert.deepEqual(inspections, before);
});

test('not-yet-inspected and retained history do not produce a latest available inspection', () => {
  assert.equal(inspectionTimeline([{ date: '1900-01-01', outcome: 'not-yet-inspected', citations: [] }]).latest, undefined);
  assert.equal(inspectionTimeline([{ date: '2025-01-01', removedFromSource: true, citations: [] }]).latest, undefined);
  assert.deepEqual(inspectionTimeline([]), { years: [], latest: undefined });
});

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

test('an inspection that became "no violations" still lists the retained citations that saved records use', () => {
  const retained = { id: 'c-old', removedFromSource: true };
  const inspection = { id: 'i1', outcome: 'no-violations', citations: [retained] };
  assert.equal(inspectionNotice(inspection), 'no-violations');
  assert.deepEqual(citationsFor({ inspections: [inspection] }).map((citation) => [citation.id, citation.historical]), [['c-old', true]]);
});

test('inspection notices separate no violations, not yet inspected, and missing details, and stay quiet when citations exist', () => {
  assert.equal(inspectionNotice({ outcome: 'no-violations', citations: [] }), 'no-violations');
  assert.equal(inspectionNotice({ outcome: 'not-yet-inspected', citations: [] }), 'not-yet-inspected');
  assert.equal(inspectionNotice({ outcome: 'violations', citations: [] }), 'details-unavailable');
  assert.equal(inspectionNotice({ citations: [] }), 'details-unavailable');
  assert.equal(inspectionNotice({ outcome: 'violations', citations: [{ id: 'c1' }] }), null);
});

test('a location missing from the list still resolves from its detail response, so saved work stays reachable', () => {
  const listed = { id: 'a', name: 'Listed' };
  const removed = { id: 'b', name: 'No longer listed' };
  const response = { locations: [listed] };
  assert.equal(locationFor(response, { location: listed }, 'a'), listed);
  assert.equal(locationFor(response, { location: removed }, 'b'), removed);
  assert.equal(locationFor(response, undefined, 'b'), null);
  assert.equal(locationFor(null, undefined, 'b'), null);
});
