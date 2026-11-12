import { updateDb } from './store.js';

// Puts the confirmed location-to-permit matches (data/confirmed-matches.json) into a store whose directory was just
// synced, so a fresh store reaches the same 38 verified locations without the manual confirmation steps.
// `permits` is data/permit-directory.json: each CAMIS must be in it, and its city map position becomes the pin.
export async function restoreConfirmedMatches({ confirmed, permits, dir, now = new Date() }) {
  const byCamis = new Map(permits.permits.map((permit) => [permit.camis, permit]));
  return updateDb((db) => {
    for (const match of confirmed.matches) {
      const location = db.locations[match.id];
      if (!location) throw new Error(`Unknown location "${match.id}". Run npm run data:sync first.`);
      const permit = byCamis.get(match.camis);
      if (!permit) throw new Error(`CAMIS ${match.camis} (${match.id}) is not in the city permit list. Run npm run data:permits.`);
      Object.assign(location, {
        matchStatus: 'verified', camis: match.camis, coordinates: permit.coordinates, candidates: [],
        confirmedByManager: Boolean(match.confirmedByManager), matchedAt: now.toISOString(),
      });
    }
    return { restored: confirmed.matches.length };
  }, dir);
}
