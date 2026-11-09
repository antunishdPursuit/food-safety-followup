import test from 'node:test';
import assert from 'node:assert/strict';
import { computeFlags, describeChecks, regionalSignalsFor, suggestionFor, allCitations } from '../lib/server/rules.js';

const city = 'Public NYC inspection';
const citation = (id, code, description = 'finding') => ({ id, code, description, critical: false });
const inspection = (id, date, citations, source = city) => ({ id, date, type: 'Cycle Inspection', source, citations });

const history = [
  inspection('i2', '2026-10-08', [citation('c3', '06D')]),
  inspection('i1', '2026-09-18', [citation('c1', '06D'), citation('c2', '10F')]),
];

test('a citation with no linked follow-up is flagged for review, wording city records as city records', () => {
  const flags = computeFlags(history, []);
  const unlinked = flags.filter((flag) => flag.type === 'Needs review');
  assert.deepEqual(unlinked.map((flag) => flag.id), ['unlinked-c3', 'unlinked-c1', 'unlinked-c2']);
  assert.match(unlinked[0].reason, /^City citation 06D on 2026-10-08 has no linked follow-up/);
  assert.match(unlinked[0].reason, /does not establish whether action was taken elsewhere/);
});

test('a follow-up clears only its own citation', () => {
  const flags = computeFlags(history, [{ citationId: 'c1' }]);
  assert.ok(!flags.some((flag) => flag.id === 'unlinked-c1'));
  assert.ok(flags.some((flag) => flag.id === 'unlinked-c3'));
});

test('a repeat code stays flagged after the earlier follow-up is complete, and lists every citation', () => {
  const flags = computeFlags(history, [{ citationId: 'c1', status: 'Complete' }]);
  const repeat = flags.find((flag) => flag.id === 'repeat-06D');
  assert.deepEqual(repeat.citationIds, ['c3', 'c1']);
  assert.match(repeat.reason, /2026-09-18 and 2026-10-08/);
});

test('the same code twice on one inspection date is not a repeat', () => {
  const flags = computeFlags([inspection('i1', '2026-09-18', [citation('a', '06D', 'one'), citation('b', '06D', 'two')])], []);
  assert.ok(!flags.some((flag) => flag.type === 'Repeat code'));
});

test('fixture citations are labelled as samples, never as city records', () => {
  const flags = computeFlags([inspection('i1', '2026-09-18', [citation('c1', '06D')], 'Sample public-data fixture'), inspection('i2', '2026-10-08', [citation('c2', '06D')], 'Sample public-data fixture')], []);
  assert.match(flags[0].reason, /^Sample citation/);
  assert.match(flags.find((flag) => flag.type === 'Repeat code').reason, /not verified city records/);
});

test('a demo check suggests a citation only from an explicit reference', () => {
  const citations = allCitations(history);
  assert.equal(suggestionFor({ citationCode: '06D' }, citations).citationId, 'c3');
  assert.equal(suggestionFor({ suggestedCitationId: 'c1' }, citations).citationId, 'c1');
  assert.equal(suggestionFor({ suggestedCitationId: 'gone' }, citations), null);
  assert.equal(suggestionFor({ citationCode: '99Z' }, citations), null);
  assert.equal(suggestionFor({ type: 'Walkthrough', note: 'Similar wording to a citation, but no code.' }, citations), null);
});

test('the manager’s link or dismissal decides which flags show a supporting demo check', () => {
  const citations = allCitations(history);
  const checks = [{ id: 'k1', citationCode: '06D' }];
  const undecided = describeChecks(checks, {}, citations);
  assert.deepEqual(computeFlags(history, [], undecided).find((flag) => flag.id === 'unlinked-c3').checkIds, ['k1']);
  const dismissed = describeChecks(checks, { k1: { decision: 'dismissed', citationId: 'c3', decidedAt: 'now' } }, citations);
  assert.deepEqual(computeFlags(history, [], dismissed).find((flag) => flag.id === 'unlinked-c3').checkIds, []);
  const linked = describeChecks(checks, { k1: { decision: 'linked', citationId: 'c1', decidedAt: 'now' } }, citations);
  const flags = computeFlags(history, [], linked);
  assert.deepEqual(flags.find((flag) => flag.id === 'unlinked-c1').checkIds, ['k1']);
  assert.deepEqual(flags.find((flag) => flag.id === 'unlinked-c3').checkIds, []);
  assert.equal(linked[0].citationCode, undefined);
});

test('a code at two or more locations is a separate regional signal, shown only for locations that have it', () => {
  const entries = [
    { location: { id: 'a', name: 'A' }, inspections: [inspection('i1', '2026-09-18', [citation('c1', '06D', 'Surface not sanitized')])] },
    { location: { id: 'b', name: 'B' }, inspections: [inspection('i2', '2026-10-01', [citation('c2', '06D', 'Surface not sanitized'), citation('c3', '10F')])] },
    { location: { id: 'c', name: 'C' }, inspections: [] },
  ];
  const signals = regionalSignalsFor('a', entries);
  assert.equal(signals.length, 1);
  assert.equal(signals[0].code, '06D');
  assert.equal(signals[0].locationCount, 2);
  assert.deepEqual(signals[0].locations.map((place) => place.id), ['a', 'b']);
  assert.deepEqual(regionalSignalsFor('b', entries).map((signal) => signal.code), ['06D']);
  assert.deepEqual(regionalSignalsFor('c', entries), []);
});
