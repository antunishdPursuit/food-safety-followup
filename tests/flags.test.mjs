import test from 'node:test';
import assert from 'node:assert/strict';
import { detailResponses } from '../lib/fixtures.js';
import { computeFlags } from '../lib/server/rules.js';

test('repeat flags remain after an earlier follow-up is complete', () => {
  const detail = detailResponses['sample-midtown'];
  const completed = [{ ...detail.followUps[0], status: 'Complete' }];
  assert.ok(computeFlags(detail.inspections, completed).some((flag) => flag.id === 'repeat-06D'));
});

test('a follow-up only clears the unlinked flag for its own citation', () => {
  const detail = detailResponses['sample-midtown'];
  const flags = computeFlags(detail.inspections, [...detail.followUps, { citationId: 'citation-1' }]);
  assert.ok(!flags.some((flag) => flag.id === 'unlinked-citation-1'));
  assert.ok(flags.some((flag) => flag.id === 'unlinked-citation-3'));
});
