import { detailResponses, locationsResponse } from '../fixtures.js';
import { emptyDb, updateDb } from './store.js';

// Loads the labeled sample fixture (data/preview.json) into a store so the API can demonstrate every flag and
// state without city data. Sample records keep their "Sample public-data fixture" and "Fictional demo check" labels.
export function buildSampleDb(now = new Date()) {
  const at = now.toISOString();
  const db = emptyDb();
  db.mode = 'sample';
  for (const row of locationsResponse.locations) {
    db.locations[row.id] = {
      id: row.id, name: row.name, address: row.address, coordinates: row.coordinates,
      camis: null, matchStatus: 'unverified', candidates: [], lastRefreshed: null, delisted: false, isSample: true,
    };
    const detail = detailResponses[row.id];
    db.inspections[row.id] = detail.inspections.map((inspection) => ({
      ...inspection,
      outcome: inspection.outcome || (inspection.citations.length ? 'citations' : 'unknown'),
    }));
    for (const check of detail.internalChecks) db.internalChecks[check.id] = { ...check, locationId: row.id };
    for (const followUp of detail.followUps) {
      db.followUps[followUp.id] = {
        ...followUp, source: 'Prototype follow-up', completedAt: null, createdAt: at, updatedAt: at,
        history: [{ status: followUp.status, at }],
      };
    }
  }
  return db;
}

// Refuses to overwrite a store that already holds live locations.
export async function seedSample({ dir, now } = {}) {
  return updateDb((db) => {
    if (db.mode === 'live' && Object.keys(db.locations).length) {
      throw new Error('This store holds live locations. Seed the sample into a separate FSF_DATA_DIR.');
    }
    const sample = buildSampleDb(now);
    Object.keys(db).forEach((key) => { if (key !== 'version') delete db[key]; });
    Object.assign(db, sample, { version: db.version });
    return { locations: Object.keys(db.locations).length };
  }, dir);
}
