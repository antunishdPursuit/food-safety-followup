import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeStore } from '../lib/server/status.js';

const db = {
  locations: {
    a: { id: 'a', matchStatus: 'verified', confirmedByManager: false },
    b: { id: 'b', matchStatus: 'verified', confirmedByManager: true },
    c: { id: 'c', matchStatus: 'candidate' },
    d: { id: 'd', matchStatus: 'unverified' },
    gone: { id: 'gone', matchStatus: 'verified', delisted: true },
  },
  inspections: {
    a: [{ id: 'i1', citations: [{}, {}] }, { id: 'i2', citations: [{}] }],
    b: [{ id: 'i3', citations: [{}] }, { id: 'i4', previousPermit: true, citations: [{}, {}] }],
    gone: [{ id: 'i5', citations: [{}] }],
  },
  importStatus: { lastSuccess: '2026-11-09T17:39:11.188Z', lastAttempt: '2026-11-09T17:39:11.188Z', error: null },
};

test('the summary is dated and separates automatic matches from the manager’s confirmations', () => {
  const summary = summarizeStore(db, new Date('2026-11-09T18:00:00Z'));
  assert.equal(summary.checkedAt, '2026-11-09T18:00:00.000Z');
  assert.deepEqual([summary.locations, summary.verified, summary.verifiedAutomatically, summary.confirmedByManager], [4, 2, 1, 1]);
  assert.deepEqual([summary.candidates, summary.unverified], [1, 1]);
});

test('inspection and citation totals count current records only, apart from history and removed locations', () => {
  const summary = summarizeStore(db);
  assert.deepEqual([summary.inspections, summary.citations, summary.historyCitations], [3, 4, 2]);
  assert.equal(summary.lastSuccess, '2026-11-09T17:39:11.188Z');
});
