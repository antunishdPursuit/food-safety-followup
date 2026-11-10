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

const NEW_YORK_DATE = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' });

// The calendar date in New York (YYYY-MM-DD), wherever this code runs. Due dates are New York dates, so a server or a
// browser set to another zone must not decide that a follow-up due today has become overdue.
export function newYorkDate(now = new Date()) {
  const parts = Object.fromEntries(NEW_YORK_DATE.formatToParts(now).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function isOverdue(action, today = new Date()) {
  if (action.status === 'Complete' || !action.dueDate) return false;
  return action.dueDate < newYorkDate(today);
}
