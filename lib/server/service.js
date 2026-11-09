import { isOverdue } from '../followUps.js';
import { staleAfterHours } from './config.js';
import { ApiError } from './http.js';
import { allCitations, computeFlags, describeChecks, regionalSignalsFor } from './rules.js';
import { readDb } from './store.js';

const SOURCES = {
  live: { name: 'Sweetgreen public locations page, matched to NYC DOHMH Restaurant Inspection Results', url: 'https://www.sweetgreen.com/locations' },
  sample: { name: 'Sample location fixture', url: null },
};

const newestFirst = (a, b) => (b.date || '').localeCompare(a.date || '') || a.id.localeCompare(b.id);

function recordsFor(db, locationId, now) {
  const inspections = [...(db.inspections[locationId] || [])].sort(newestFirst);
  const followUps = Object.values(db.followUps)
    .filter((item) => item.locationId === locationId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
    .map((item) => ({ ...item, overdue: isOverdue(item, now) }));
  const checks = describeChecks(
    Object.values(db.internalChecks).filter((item) => item.locationId === locationId).sort(newestFirst),
    db.links,
    allCitations(inspections),
  );
  return { inspections, followUps, checks, flags: computeFlags(inspections, followUps, checks) };
}

function dataState(location, inspections) {
  if (location.matchStatus !== 'verified') return 'unmatched';
  if (inspections.length) return 'records';
  return location.lastRefreshed ? 'no-records' : 'not-imported';
}

function locationRow(location, { inspections, followUps, flags }) {
  const open = followUps.filter((item) => item.status !== 'Complete');
  return {
    id: location.id,
    name: location.name,
    address: location.address,
    coordinates: location.coordinates || null,
    camis: location.camis || null,
    matchStatus: location.matchStatus,
    dataState: dataState(location, inspections),
    // Null means there is no inspection record to count. It is never reported as zero.
    citationCount: inspections.length ? inspections.reduce((sum, inspection) => sum + inspection.citations.length, 0) : null,
    openFollowUpCount: open.length,
    overdueFollowUpCount: open.filter((item) => item.overdue).length,
    flagCount: flags.length,
    candidateCount: (location.candidates || []).length,
    lastRefreshed: location.lastRefreshed || null,
    sourceUrl: location.sourceUrl || null,
    isSample: Boolean(location.isSample),
  };
}

function importStatusFor(db, listed, now) {
  const verified = listed.filter((location) => location.matchStatus === 'verified').length;
  const { lastSuccess, lastAttempt, error } = db.importStatus;
  let state;
  if (db.mode === 'sample') state = 'not-connected';
  else if (error) state = 'failed';
  else if (!lastSuccess) state = 'never-run';
  else if (now - new Date(lastSuccess) > staleAfterHours() * 3600 * 1000) state = 'stale';
  else state = 'ok';
  return {
    state,
    lastSuccess,
    lastAttempt,
    error,
    verifiedCount: verified,
    totalCount: listed.length,
    coverage: `${verified} of ${listed.length} ${db.mode === 'sample' ? 'sample ' : ''}locations verified`,
    staleAfterHours: staleAfterHours(),
    source: db.mode === 'sample' ? { name: 'Sample public-data fixture', url: null } : { name: 'NYC DOHMH Restaurant Inspection Results', url: 'https://data.cityofnewyork.us/Health/DOHMH-New-York-City-Restaurant-Inspection-Results/43nn-pn8j' },
  };
}

// One response feeds both the map pins and the list rows, so a pin and its row open the same location id.
export async function listLocations({ dir, now = new Date() } = {}) {
  const db = await readDb(dir);
  const listed = Object.values(db.locations).filter((location) => !location.delisted).sort((a, b) => a.name.localeCompare(b.name));
  return {
    source: (SOURCES[db.mode] || SOURCES.live).name,
    importStatus: importStatusFor(db, listed, now),
    locations: listed.map((location) => locationRow(location, recordsFor(db, location.id, now))),
  };
}

export async function getLocationDetail(id, { dir, now = new Date() } = {}) {
  const db = await readDb(dir);
  const location = Object.hasOwn(db.locations, id) ? db.locations[id] : null;
  if (!location) throw new ApiError(404, 'location_not_found', 'This location does not exist.');
  const records = recordsFor(db, id, now);
  const listed = Object.values(db.locations).filter((item) => !item.delisted);
  const regionalSignals = regionalSignalsFor(id, listed.map((item) => ({ location: item, inspections: db.inspections[item.id] || [] })));
  return {
    locationId: id,
    location: locationRow(location, records),
    importStatus: importStatusFor(db, listed, now),
    inspections: records.inspections,
    internalChecks: records.checks,
    followUps: records.followUps,
    flags: records.flags,
    regionalSignals,
  };
}
