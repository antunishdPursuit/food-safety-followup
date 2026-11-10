import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDate, formatTimestamp, formatDateMentions, countLabel, permitStatusLabel, locationCitationLabel } from '../lib/presentation.js';

test('calendar dates keep their source day and reject invalid or missing dates', () => {
  assert.equal(formatDate('2025-11-05'), '5 Nov 2025');
  assert.equal(formatDate('2026-01-01'), '1 Jan 2026');
  assert.equal(formatDate('2025-02-30'), 'Date unavailable');
  assert.equal(formatDate(null), 'Date unavailable');
  assert.equal(formatDate(''), 'Date unavailable');
});

test('timestamps use the New York calendar, including the daylight-saving transition', () => {
  assert.equal(formatTimestamp('2026-11-10T01:30:00Z'), '9 Nov 2026, 8:30 PM (New York)');
  assert.equal(formatTimestamp('2026-03-08T06:30:00Z'), '8 Mar 2026, 1:30 AM (New York)');
  assert.equal(formatTimestamp('2026-03-08T07:30:00Z'), '8 Mar 2026, 3:30 AM (New York)');
  assert.equal(formatTimestamp(null), 'Not recorded');
  assert.equal(formatTimestamp('not-a-date'), 'Not recorded');
});

test('review reasons format valid dates without changing codes or invalid source text', () => {
  assert.equal(formatDateMentions('Code 10F on 2024-05-21 and 2025-11-05.'), 'Code 10F on 21 May 2024 and 5 Nov 2025.');
  assert.equal(formatDateMentions('Unknown 2025-02-30.'), 'Unknown 2025-02-30.');
});

test('record labels distinguish one citation from zero or multiple citations', () => {
  assert.equal(countLabel(1, 'recorded citation'), '1 recorded citation');
  assert.equal(countLabel(0, 'open follow-up'), '0 open follow-ups');
  assert.equal(countLabel(2, 'inspection'), '2 inspections');
});

test('permit labels cover automatic and manager matches without claiming a manual decision', () => {
  assert.equal(permitStatusLabel({ matchStatus: 'verified', confirmedByManager: false }), 'Permit matched');
  assert.equal(permitStatusLabel({ matchStatus: 'verified', confirmedByManager: true }), 'Permit matched');
  assert.equal(permitStatusLabel({ matchStatus: 'candidate' }), 'Permit confirmation pending');
  assert.equal(permitStatusLabel({ isSample: true, matchStatus: 'unverified' }), 'Sample location');
});

test('missing inspections stay distinct from zero citations and fictional fixtures', () => {
  assert.equal(locationCitationLabel({ citationCount: 0 }), '0 recorded citations');
  assert.equal(locationCitationLabel({ citationCount: 1 }), '1 recorded citation');
  assert.equal(locationCitationLabel({ citationCount: null, matchStatus: 'candidate' }), '');
  assert.equal(locationCitationLabel({ citationCount: null, matchStatus: 'verified', dataState: 'not-imported' }), 'Inspection import pending');
  assert.equal(locationCitationLabel({ citationCount: null, matchStatus: 'verified', dataState: 'no-records' }), 'No inspection records');
  assert.equal(locationCitationLabel({ citationCount: null, isSample: true }), 'No sample inspections');
});
