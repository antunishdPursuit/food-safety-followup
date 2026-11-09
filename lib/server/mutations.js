import { randomUUID } from 'node:crypto';
import { isOverdue, makeFollowUp } from '../followUps.js';
import { ApiError } from './http.js';
import { allCitations, currentInspections, describeChecks, suggestionFor } from './rules.js';
import { updateDb } from './store.js';

const STATUSES = ['Open', 'In progress', 'Complete'];
const CREATE_FIELDS = ['locationId', 'citationId', 'checkId', 'owner', 'dueDate', 'notes', 'status', 'completionNote'];
const EDIT_FIELDS = ['owner', 'dueDate', 'notes', 'status', 'completionNote'];
const LINK_FIELDS = ['locationId', 'citationId', 'checkId'];
const TEXT_LIMITS = { owner: 100, notes: 2000, completionNote: 2000, locationId: 200, citationId: 200, checkId: 200, status: 20, dueDate: 10 };

const has = (object, key) => Object.hasOwn(object, key);
const pick = (source, keys) => Object.fromEntries(keys.filter((key) => source[key] !== undefined).map((key) => [key, source[key]]));

function fail(fields) {
  throw new ApiError(422, 'validation_failed', 'Some fields need attention.', fields);
}

// Checked before the shared validator, which assumes every field is text.
function textErrors(input) {
  const errors = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === null) continue;
    if (typeof value !== 'string') errors[key] = 'Enter text.';
    else if (value.length > TEXT_LIMITS[key]) errors[key] = `Keep this under ${TEXT_LIMITS[key]} characters.`;
  }
  return errors;
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

const shown = (record, now) => ({ ...record, overdue: isOverdue(record, now) });

// New work can only point at the location's current inspections. Findings kept as history exist so earlier follow-ups
// keep their context: those from a previous permit, and those the city no longer lists. They are never suggested or
// chosen again, but an existing follow-up that points at one stays editable.
function currentCitations(db, locationId) {
  return allCitations(currentInspections(db.inspections[locationId] || []));
}

function citationProblem(db, locationId, citationId) {
  if (currentCitations(db, locationId).some((citation) => citation.id === citationId)) return null;
  const found = (db.inspections[locationId] || [])
    .flatMap((inspection) => inspection.citations.map((citation) => ({ citation, inspection })))
    .find((entry) => entry.citation.id === citationId);
  if (!found) return 'This citation is not part of this location.';
  return found.inspection.previousPermit
    ? 'This finding is history from a previous permit and cannot be used for new work.'
    : 'This finding is no longer in the city records and cannot be used for new work.';
}

export async function createFollowUp(input, { dir, now = new Date() } = {}) {
  const clean = pick(input, CREATE_FIELDS);
  const typeProblems = textErrors(clean);
  if (Object.keys(typeProblems).length) fail(typeProblems);
  const status = clean.status || 'Open';
  const at = now.toISOString();

  return updateDb((db) => {
    const location = typeof clean.locationId === 'string' && has(db.locations, clean.locationId) ? db.locations[clean.locationId] : null;
    if (!location) throw new ApiError(404, 'location_not_found', 'This location does not exist.');
    const errors = {};
    if (!STATUSES.includes(status)) errors.status = 'Choose Open, In progress, or Complete.';
    if (clean.dueDate && !validDate(clean.dueDate)) errors.dueDate = 'Use a real date in YYYY-MM-DD form.';
    if (clean.citationId) {
      const problem = citationProblem(db, location.id, clean.citationId);
      if (problem) errors.citationId = problem;
    }
    if (clean.checkId && !(has(db.internalChecks, clean.checkId) && db.internalChecks[clean.checkId].locationId === location.id)) {
      errors.checkId = 'This demo check is not part of this location.';
    }
    const made = makeFollowUp({ ...clean, status }, `fu-${randomUUID()}`);
    const problems = { ...made.errors, ...errors };
    if (Object.keys(problems).length) fail(problems);

    const record = {
      ...made.record,
      source: 'Prototype follow-up',
      completedAt: status === 'Complete' ? at : null,
      createdAt: at,
      updatedAt: at,
      history: [{ status, at }],
    };
    db.followUps[record.id] = record;
    return shown(record, now);
  }, dir);
}

export async function updateFollowUp(id, patch, { dir, now = new Date() } = {}) {
  const clean = pick(patch, EDIT_FIELDS);
  const attemptedLinks = pick(patch, LINK_FIELDS);
  const typeProblems = textErrors({ ...clean, ...attemptedLinks });
  if (Object.keys(typeProblems).length) fail(typeProblems);
  const at = now.toISOString();

  return updateDb((db) => {
    if (!has(db.followUps, id)) throw new ApiError(404, 'follow_up_not_found', 'This follow-up does not exist.');
    const existing = db.followUps[id];
    const errors = {};
    for (const [key, value] of Object.entries(attemptedLinks)) {
      if ((value ?? null) !== (existing[key] ?? null)) errors[key] = 'The linked finding cannot be changed. Create a new follow-up instead.';
    }
    if (clean.status !== undefined && !STATUSES.includes(clean.status)) errors.status = 'Choose Open, In progress, or Complete.';
    if (clean.dueDate && !validDate(clean.dueDate)) errors.dueDate = 'Use a real date in YYYY-MM-DD form.';
    const made = makeFollowUp({ ...existing, ...clean }, id);
    const problems = { ...made.errors, ...errors };
    if (Object.keys(problems).length) fail(problems);

    const previous = existing.status;
    const next = made.record.status;
    const history = next === previous
      ? existing.history
      : [...existing.history, { status: next, at, ...(next === 'Complete' ? { note: made.record.completionNote } : previous === 'Complete' ? { note: 'Reopened' } : {}) }];
    const record = {
      ...existing,
      ...made.record,
      completedAt: next === 'Complete' ? (previous === 'Complete' ? existing.completedAt : at) : null,
      updatedAt: at,
      history,
    };
    db.followUps[id] = record;
    return shown(record, now);
  }, dir);
}

// The manager links a demo check to a citation or dismisses the suggestion. Records stay separate either way.
export async function setCheckLink(checkId, body, { dir, now = new Date() } = {}) {
  const decision = body.decision;
  const citationId = body.citationId ?? null;
  const problems = {};
  if (decision !== 'linked' && decision !== 'dismissed') problems.decision = 'Choose linked or dismissed.';
  if (citationId !== null && typeof citationId !== 'string') problems.citationId = 'Enter text.';
  if (Object.keys(problems).length) fail(problems);

  return updateDb((db) => {
    if (!has(db.internalChecks, checkId)) throw new ApiError(404, 'check_not_found', 'This demo check does not exist.');
    const check = db.internalChecks[checkId];
    const citations = currentCitations(db, check.locationId);
    const target = citationId ?? suggestionFor(check, citations)?.citationId ?? null;
    if (decision === 'linked' && !target) fail({ citationId: 'Choose the citation to link.' });
    if (target !== null) {
      const problem = citationProblem(db, check.locationId, target);
      if (problem) fail({ citationId: problem });
    }
    db.links[checkId] = { checkId, locationId: check.locationId, decision, citationId: target, decidedAt: now.toISOString() };
    return describeChecks([check], db.links, citations)[0];
  }, dir);
}
