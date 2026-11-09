import { readFileSync } from 'node:fs';
import { buildingVariants, parseAddress } from './address.js';
import { matchLocations } from './matching.js';
import { groupInspections } from './nyc.js';
import { readDb, updateDb } from './store.js';

export function loadDirectorySnapshot(url = new URL('../../data/sweetgreen-nyc-locations.json', import.meta.url)) {
  return JSON.parse(readFileSync(url, 'utf8'));
}

// Step 1: bring the saved Sweetgreen directory into the store. Existing match results and follow-ups are kept.
// A location that left the directory is hidden from the list, not deleted.
export async function syncDirectory({ snapshot = loadDirectorySnapshot(), dir } = {}) {
  return updateDb((db) => {
    const listed = new Set(snapshot.locations.map((entry) => entry.id));
    for (const entry of snapshot.locations) {
      db.locations[entry.id] = {
        camis: null, matchStatus: 'unverified', candidates: [], coordinates: null, confirmedByManager: false, lastRefreshed: null,
        ...db.locations[entry.id],
        id: entry.id, name: entry.name, address: entry.address, street: entry.street, zip: entry.zip, sourceUrl: entry.sourceUrl, delisted: false,
      };
    }
    for (const location of Object.values(db.locations)) if (!listed.has(location.id)) location.delisted = true;
    db.directory = { fetchedAt: snapshot.fetchedAt, sourceUrl: snapshot.sourceUrl };
    return { locations: snapshot.locations.length };
  }, dir);
}

// Step 2: look each location up in the city dataset by address and record verified matches and candidates.
// A match the manager confirmed is never replaced by an automatic result.
export async function matchLocationsToCity({ client, dir, now = new Date() } = {}) {
  const locations = Object.values((await readDb(dir)).locations).filter((location) => !location.delisted && location.street && location.zip);
  const establishments = await client.findSweetgreenEstablishments();
  let results = matchLocations(locations, establishments);

  const extra = new Map();
  for (const location of locations.filter((item) => results[item.id].matchStatus !== 'verified')) {
    for (const building of buildingVariants(parseAddress(location.street).building)) {
      for (const found of await client.findEstablishmentsAtAddress(location.zip, building)) extra.set(found.camis, found);
    }
  }
  if (extra.size) {
    const known = new Set(establishments.map((item) => item.camis));
    results = matchLocations(locations, [...establishments, ...[...extra.values()].filter((item) => !known.has(item.camis))]);
  }

  return updateDb((db) => {
    const summary = { verified: 0, candidate: 0, unverified: 0 };
    for (const [id, result] of Object.entries(results)) {
      const location = db.locations[id];
      if (!location) continue;
      if (!(location.confirmedByManager && location.matchStatus === 'verified')) {
        if (location.camis !== result.camis) delete db.inspections[id];
        Object.assign(location, { matchStatus: result.matchStatus, camis: result.camis, candidates: result.candidates, coordinates: result.coordinates, matchedAt: now.toISOString() });
      }
      summary[location.matchStatus] += 1;
    }
    return summary;
  }, dir);
}

// The manager picks one of a location's candidate permits.
export async function confirmMatch({ locationId, camis, dir, now = new Date() }) {
  return updateDb((db) => {
    const location = db.locations[locationId];
    if (!location) throw new Error(`Unknown location "${locationId}".`);
    const candidate = location.candidates.find((item) => item.camis === camis);
    if (!candidate) throw new Error(`CAMIS ${camis} is not a candidate for ${locationId}.`);
    delete db.inspections[locationId];
    Object.assign(location, { matchStatus: 'verified', camis, coordinates: candidate.coordinates || null, candidates: [], confirmedByManager: true, matchedAt: now.toISOString() });
    return location;
  }, dir);
}

// A city record that disappeared stays visible only while a follow-up or a manager decision still points at it.
export function mergeInspections(stored, fresh, referencedCitationIds) {
  const merged = fresh.map((inspection) => ({ ...inspection, citations: [...inspection.citations] }));
  for (const old of stored) {
    const target = merged.find((inspection) => inspection.id === old.id);
    const keptCitations = old.citations.filter((citation) =>
      referencedCitationIds.has(citation.id) && !(target && target.citations.some((item) => item.id === citation.id)));
    if (target) target.citations.push(...keptCitations.map((citation) => ({ ...citation, removedFromSource: true })));
    else if (keptCitations.length) merged.push({ ...old, removedFromSource: true, citations: keptCitations.map((citation) => ({ ...citation, removedFromSource: true })) });
  }
  return merged;
}

// Step 3: refresh inspection records for every verified location in one pass. If the city request fails, nothing
// stored changes except the recorded error, so existing records and follow-ups stay available.
export async function refreshInspections({ client, dir, now = new Date() } = {}) {
  const attemptedAt = now.toISOString();
  const targets = Object.values((await readDb(dir)).locations).filter((location) => !location.delisted && location.matchStatus === 'verified' && location.camis);
  let rows;
  try {
    rows = targets.length ? await client.fetchInspectionRows(targets.map((location) => location.camis)) : [];
  } catch (error) {
    await updateDb((db) => { db.importStatus = { ...db.importStatus, lastAttempt: attemptedAt, error: error.message }; }, dir);
    return { ok: false, error: error.message };
  }
  const rowsByCamis = new Map();
  for (const row of rows) rowsByCamis.set(row.camis, [...(rowsByCamis.get(row.camis) || []), row]);

  return updateDb((db) => {
    let inspections = 0;
    let citations = 0;
    for (const target of targets) {
      const location = db.locations[target.id];
      if (!location || location.camis !== target.camis) continue;
      const referenced = new Set([
        ...Object.values(db.followUps).filter((item) => item.locationId === location.id).map((item) => item.citationId),
        ...Object.values(db.links).filter((item) => item.locationId === location.id).map((item) => item.citationId),
      ].filter(Boolean));
      const merged = mergeInspections(db.inspections[location.id] || [], groupInspections(rowsByCamis.get(location.camis) || []), referenced);
      db.inspections[location.id] = merged;
      location.lastRefreshed = attemptedAt;
      inspections += merged.length;
      citations += merged.reduce((sum, inspection) => sum + inspection.citations.length, 0);
    }
    db.importStatus = { lastSuccess: attemptedAt, lastAttempt: attemptedAt, error: null };
    return { ok: true, locations: targets.length, inspections, citations };
  }, dir);
}
