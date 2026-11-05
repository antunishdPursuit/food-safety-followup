export function validateFollowUp(input) {
  const errors = {};
  if (!input.owner?.trim()) errors.owner = 'Enter an action owner.';
  if (!input.dueDate) errors.dueDate = 'Choose a due date.';
  if (!input.notes?.trim()) errors.notes = 'Describe the action.';
  if (input.status === 'Complete' && !input.completionNote?.trim()) errors.completionNote = 'Add a completion note.';
  if (!input.citationId && !input.checkId) errors.finding = 'Choose a finding.';
  return errors;
}

export function makeFollowUp(input, id) {
  const errors = validateFollowUp(input);
  if (Object.keys(errors).length) return { errors };
  return { record: {
    id,
    locationId: input.locationId,
    citationId: input.citationId || null,
    checkId: input.checkId || null,
    owner: input.owner.trim(),
    dueDate: input.dueDate,
    notes: input.notes.trim(),
    status: input.status,
    completionNote: input.status === 'Complete' ? input.completionNote.trim() : '',
  } };
}
