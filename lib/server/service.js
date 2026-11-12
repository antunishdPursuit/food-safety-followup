import { isOverdue, newYorkDate } from '../followUps.js';
import { staleAfterHours } from './config.js';
import { ApiError } from './http.js';
import { allCitations, computeFlags, currentInspections, describeChecks, regionalSignalsFor } from './rules.js';
import { readDb } from './store.js';

const SOURCES = {
  live: { name: 'NYC DOHMH Restaurant Inspection Results (permit list and inspections)', url: 'https://data.cityofnewyork.us/Health/DOHMH-New-York-City-Restaurant-Inspection-Results/43nn-pn8j' },
  sample: { name: 'Sample location fixture', url: null },
};

const newestFirst = (a, b) => (b.date || '').localeCompare(a.date || '') || a.id.localeCompare(b.id);

function recordsFor(db, locationId, now) {
  const inspections = [...(db.inspections[locationId] || [])].sort(newestFirst);
  const followUps = Object.values(db.followUps)
    .filter((item) => item.locationId === locationId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
    .map((item) => ({ ...item, overdue: isOverdue(item, now) }));
  // Findings kept as history (from a previous permit, or no longer in the city records) stay visible for the follow-ups
  // that point at them, but they are not current records: they do not count, raise flags, or suggest matches.
  const current = currentInspections(inspections);
  const checks = describeChecks(
    Object.values(db.internalChecks).filter((item) => item.locationId === locationId).sort(newestFirst),
    db.links,
    allCitations(current),
  );
  return { inspections, current, followUps, checks, flags: computeFlags(current, followUps, checks) };
}

function dataState(location, inspections) {
  if (location.matchStatus !== 'verified') return 'unmatched';
  if (inspections.length) return 'records';
  return location.lastRefreshed ? 'no-records' : 'not-imported';
}

function pinSource(location) {
  if (location.coordinates) return location.isSample ? 'Sample fixture' : 'NYC Open Data inspection record';
  return location.listedCoordinates ? location.listedCoordinatesSource || 'Location list position' : null;
}

function locationRow(location, { current: inspections, followUps, flags }) {
  const open = followUps.filter((item) => item.status !== 'Complete');
  return {
    id: location.id,
    name: location.name,
    address: location.address,
    // The pin comes from the matched city record. A location the city record cannot place falls back to the listed
    // position (the city geocoder's), and the source says which one it is.
    coordinates: location.coordinates || location.listedCoordinates || null,
    coordinatesSource: pinSource(location),
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
    // Set when the last refresh kept stored records for a permit the city returned nothing for.
    warning: db.importStatus.warning ?? null,
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

// The optional regional window: only citations from inspections in the last N months count toward regional signals.
// Absent, every current inspection counts, as before.
function parseRegionalMonths(value) {
  if (value === null || value === undefined || value === '') return null;
  if (!/^\d+$/.test(String(value)) || Number(value) < 1 || Number(value) > 120) {
    throw new ApiError(400, 'invalid_query', 'regionalMonths must be a whole number from 1 to 120.');
  }
  return Number(value);
}

// The date N months before `now`, counted from the New York calendar date and clamped to the last day of that month:
// one month before 31 March is 28 February (29 in a leap year), not 3 March.
export function monthsAgo(now, months) {
  const [nowYear, nowMonth, nowDay] = newYorkDate(now).split('-').map(Number);
  const target = nowMonth - 1 - months;
  const year = nowYear + Math.floor(target / 12);
  const month = ((target % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(nowDay, lastDay))).toISOString().slice(0, 10);
}

export async function getLocationDetail(id, { dir, now = new Date(), regionalMonths = null } = {}) {
  const months = parseRegionalMonths(regionalMonths);
  const since = months ? monthsAgo(now, months) : null;
  const db = await readDb(dir);
  const location = Object.hasOwn(db.locations, id) ? db.locations[id] : null;
  if (!location) throw new ApiError(404, 'location_not_found', 'This location does not exist.');
  const records = recordsFor(db, id, now);
  const listed = Object.values(db.locations).filter((item) => !item.delisted);
  const regionalSignals = regionalSignalsFor(id, listed.map((item) => ({ location: item, inspections: currentInspections(db.inspections[item.id] || []).filter((inspection) => !since || (inspection.date && inspection.date >= since)) })));
  return {
    locationId: id,
    location: locationRow(location, records),
    importStatus: importStatusFor(db, listed, now),
    inspections: records.inspections,
    internalChecks: records.checks,
    followUps: records.followUps,
    flags: records.flags,
    regionalSignals,
    regionalWindow: { months, since },
  };
}
