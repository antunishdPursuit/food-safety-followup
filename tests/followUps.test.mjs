import test from 'node:test';
import assert from 'node:assert/strict';
import { isOverdue, makeFollowUp, validateFollowUp } from '../lib/followUps.js';

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

test('a manager can link one action to both a citation and demo check', () => {
  const saved = makeFollowUp({ locationId: 'sample-midtown', citationId: 'citation-1', checkId: 'check-1', owner: 'Manager', dueDate: '2026-11-20', notes: 'Review both records.', status: 'Open' }, 'action-1').record;
  assert.equal(saved.citationId, 'citation-1');
  assert.equal(saved.checkId, 'check-1');
});

test('overdue status applies only to unfinished actions past their due date', () => {
  const today = new Date('2026-11-04T17:00:00Z');
  assert.equal(isOverdue({ status: 'Open', dueDate: '2026-10-15' }, today), true);
  assert.equal(isOverdue({ status: 'Complete', dueDate: '2026-10-15' }, today), false);
  assert.equal(isOverdue({ status: 'In progress', dueDate: '2026-11-04' }, today), false);
});
