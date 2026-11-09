import { buildingVariants, parseAddress } from './address.js';
import { matchLocations } from './matching.js';
import { groupInspections } from './nyc.js';
import { readDb, updateDb } from './store.js';

// Citations that a follow-up or a manager decision still points at.
function referencedCitationIds(db, locationId) {
  return new Set([
    ...Object.values(db.followUps).filter((item) => item.locationId === locationId).map((item) => item.citationId),
    ...Object.values(db.links).filter((item) => item.locationId === locationId).map((item) => item.citationId),
  ].filter(Boolean));
}

// When a location's permit or address changes, its stored inspections no longer describe the permit it shows.
// Only the findings a follow-up or decision still points at stay, as history, so they keep their source context.
export function keepReferencedAsHistory(db, locationId) {
  const kept = mergeInspections(db.inspections[locationId] || [], [], referencedCitationIds(db, locationId))
    .map((inspection) => ({ ...inspection, previousPermit: true }));
  if (kept.length) db.inspections[locationId] = kept;
  else delete db.inspections[locationId];
}

const sameAddress = (a, b) => {
  const first = parseAddress(a.street);
  const second = parseAddress(b.street);
  return a.zip === b.zip && first.building === second.building && first.street === second.street;
};

// Step 1: bring the saved Sweetgreen directory (data/sweetgreen-nyc-locations.json, read by the command-line
// script) into the store. Existing match results and follow-ups are kept. A location that left the directory is
// hidden from the list, not deleted.
export async function syncDirectory({ snapshot, dir }) {
  return updateDb((db) => {
    const listed = new Set(snapshot.locations.map((entry) => entry.id));
    for (const entry of snapshot.locations) {
      const existing = db.locations[entry.id];
      // A new street address means the stored permit was matched to a different place. Reset the match, including
      // one the manager confirmed, so the old permit's inspections cannot appear under the new address. Only
      // formatting differences (capitals, "Ave" or "Avenue") keep the match.
      const moved = Boolean(existing?.street) && !sameAddress(existing, entry);
      if (moved) keepReferencedAsHistory(db, entry.id);
      db.locations[entry.id] = {
        camis: null, matchStatus: 'unverified', candidates: [], coordinates: null, confirmedByManager: false, lastRefreshed: null,
        ...(moved ? {} : existing),
        id: entry.id, name: entry.name, address: entry.address, street: entry.street, zip: entry.zip, sourceUrl: entry.sourceUrl, delisted: false,
        // Sweetgreen's own published position and phone. These help match a city permit; they are not the map pin.
        listedCoordinates: entry.coordinates ?? null, listedPhone: entry.phone ?? null,
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
  const stored = Object.values((await readDb(dir)).locations);
  const locations = stored.filter((location) => !location.delisted && location.street && location.zip);
  // A permit the manager already confirmed for one location is never offered to another.
  const claimed = new Set(stored.filter((location) => location.confirmedByManager && location.camis).map((location) => location.camis));
  const establishments = await client.findSweetgreenEstablishments();
  let results = matchLocations(locations, establishments, claimed);

  const extra = new Map();
  for (const location of locations.filter((item) => results[item.id].matchStatus !== 'verified')) {
    for (const building of buildingVariants(parseAddress(location.street).building)) {
      for (const found of await client.findEstablishmentsAtAddress(location.zip, building)) extra.set(found.camis, found);
    }
  }
  if (extra.size) {
    const known = new Set(establishments.map((item) => item.camis));
    results = matchLocations(locations, [...establishments, ...[...extra.values()].filter((item) => !known.has(item.camis))], claimed);
  }

  return updateDb((db) => {
    const stamp = now.toISOString();
    for (const [id, result] of Object.entries(results)) {
      const location = db.locations[id];
      if (!location) continue;
      // A confirmed match is never replaced, and a verified match is never downgraded by a lookup that now finds
      // less (a city data glitch must not strip a location's history). Only a different verified permit replaces it.
      const keepsMatch = location.matchStatus === 'verified' && (location.confirmedByManager || result.matchStatus !== 'verified');
      if (keepsMatch) continue;
      // A new permit has not been imported, so the old permit's refresh time must not say it was checked.
      if (location.camis !== result.camis) { keepReferencedAsHistory(db, id); location.lastRefreshed = null; }
      Object.assign(location, { matchStatus: result.matchStatus, camis: result.camis, candidates: result.candidates, coordinates: result.coordinates, matchedAt: stamp });
    }

    // One permit belongs to one location. A match kept by the rule above can now clash with a permit newly assigned to
    // another location (the city lists it at that location's address), or with one the manager confirmed. The manager's
    // confirmation wins, then a permit newly verified in this run; with neither, no automatic holder keeps it.
    const holders = new Map();
    for (const location of Object.values(db.locations)) {
      if (location.matchStatus === 'verified' && location.camis) holders.set(location.camis, [...(holders.get(location.camis) || []), location]);
    }
    for (const [camis, group] of holders) {
      if (group.length < 2) continue;
      const confirmed = group.filter((location) => location.confirmedByManager);
      const fresh = group.filter((location) => !location.confirmedByManager && results[location.id]?.matchStatus === 'verified' && results[location.id].camis === camis);
      const winner = confirmed.length === 1 ? confirmed[0] : (!confirmed.length && fresh.length === 1 ? fresh[0] : null);
      for (const location of group) {
        if (location === winner || location.confirmedByManager) continue;
        keepReferencedAsHistory(db, location.id);
        const result = results[location.id];
        const reset = result && result.matchStatus !== 'verified' ? result : { matchStatus: 'unverified', candidates: [], coordinates: null };
        Object.assign(location, { matchStatus: reset.matchStatus, camis: null, candidates: reset.candidates, coordinates: reset.coordinates, lastRefreshed: null, matchedAt: stamp });
      }
    }

    const summary = { verified: 0, candidate: 0, unverified: 0 };
    for (const id of Object.keys(results)) if (db.locations[id]) summary[db.locations[id].matchStatus] += 1;
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
    const holder = Object.values(db.locations).find((item) => item.id !== locationId && item.matchStatus === 'verified' && item.camis === camis);
    if (holder) throw new Error(`CAMIS ${camis} is already matched to ${holder.id}.`);
    if (location.camis !== camis) { keepReferencedAsHistory(db, locationId); location.lastRefreshed = null; }
    Object.assign(location, { matchStatus: 'verified', camis, coordinates: candidate.coordinates || null, candidates: [], confirmedByManager: true, matchedAt: now.toISOString() });
    return location;
  }, dir);
}

// A finding is the same finding when its code, wording, and critical flag are the same.
const findingKey = (citation) => [citation.code, citation.description, citation.criticalFlag ?? ''].join('\u0000');

// groupInspections numbers same-code findings by position, so a finding the city removes would hand its id to the next one
// and a follow-up or link would quietly point at a different finding. A finding already stored keeps the id it was given
// (also when the city lists findings in another order); only a new finding takes an id that no stored finding uses.
export function keepCitationIds(stored, fresh) {
  const storedById = new Map(stored.map((inspection) => [inspection.id, inspection]));
  return fresh.map((inspection) => {
    const earlier = storedById.get(inspection.id);
    if (!earlier) return inspection;
    const known = new Map(earlier.citations.map((citation) => [findingKey(citation), citation.id]));
    const taken = new Set(earlier.citations.map((citation) => citation.id));
    const citations = inspection.citations.map((citation) => {
      if (known.has(findingKey(citation))) return { ...citation, id: known.get(findingKey(citation)) };
      const base = `${inspection.id}--${citation.code}`;
      let id = base;
      for (let n = 2; taken.has(id); n += 1) id = `${base}-${n}`;
      taken.add(id);
      return { ...citation, id };
    });
    return { ...inspection, citations };
  });
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
  // With nothing verified there is nothing to refresh, so do not record a success the app would then display.
  if (!targets.length) return { ok: false, skipped: true, error: 'No location is verified yet. Run npm run data:match first.' };
  let rows;
  try {
    rows = await client.fetchInspectionRows(targets.map((location) => location.camis));
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
      const stored = db.inspections[location.id] || [];
      const fresh = keepCitationIds(stored, groupInspections(rowsByCamis.get(location.camis) || []));
      const merged = mergeInspections(stored, fresh, referencedCitationIds(db, location.id));
      db.inspections[location.id] = merged;
      location.lastRefreshed = attemptedAt;
      inspections += merged.length;
      citations += merged.reduce((sum, inspection) => sum + inspection.citations.length, 0);
    }
    db.importStatus = { lastSuccess: attemptedAt, lastAttempt: attemptedAt, error: null };
    return { ok: true, locations: targets.length, inspections, citations };
  }, dir);
}
