import test from 'node:test';
import assert from 'node:assert/strict';
import { makeFollowUp, validateFollowUp } from '../lib/followUps.js';

test('a completed follow-up requires an explicit completion note', () => {
  const input = { locationId: 'sample-midtown', citationId: 'citation-1', owner: 'Manager', dueDate: '2026-11-15', notes: 'Check repair.', status: 'Complete', completionNote: ' ' };
  assert.equal(validateFollowUp(input).completionNote, 'Add a completion note.');
  assert.ok(makeFollowUp(input, 'test').errors);
  const saved = makeFollowUp({ ...input, completionNote: 'Repair verified in demo.' }, 'test').record;
  assert.equal(saved.status, 'Complete');
  assert.equal(saved.completionNote, 'Repair verified in demo.');
  assert.equal(saved.citationId, 'citation-1');
});

test('a follow-up must remain linked to a finding', () => {
  assert.equal(validateFollowUp({ owner: 'Manager', dueDate: '2026-11-15', notes: 'Check', status: 'Open' }).finding, 'Choose a finding.');
});
