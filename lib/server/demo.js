import { allCitations } from './rules.js';
import { readDb, updateDb } from './store.js';

const DAY = 24 * 3600 * 1000;
const isoDate = (date) => date.toISOString().slice(0, 10);

// Adds a small, clearly fictional mix of internal checks to verified locations that already have city citations.
// The temperature check explicitly references the violation code of the location's most recent citation, so it can
// suggest a match for the manager to link or dismiss. The walkthrough has no citation. Nothing is invented about
// the restaurant: both notes say they are fictional. Existing checks are never changed, so re-running is safe.
export async function seedDemoChecks({ dir, count = 3, now = new Date() } = {}) {
  const db = await readDb(dir);
  const candidates = Object.values(db.locations)
    .filter((location) => !location.delisted && location.matchStatus === 'verified')
    .map((location) => ({ location, citations: allCitations([...(db.inspections[location.id] || [])].sort((a, b) => (b.date || '').localeCompare(a.date || ''))) }))
    .filter((entry) => entry.citations.length)
    .sort((a, b) => b.citations.length - a.citations.length || a.location.id.localeCompare(b.location.id))
    .slice(0, count);

  return updateDb((state) => {
    let created = 0;
    for (const { location, citations } of candidates) {
      const checks = [
        { id: `demo-${location.id}-temperature`, date: isoDate(new Date(now - 14 * DAY)), type: 'Temperature check', note: 'Fictional demo temperature-check entry for interface testing. Not a reading from this restaurant.', citationCode: citations[0].code },
        { id: `demo-${location.id}-walkthrough`, date: isoDate(new Date(now - 13 * DAY)), type: 'Walkthrough', note: 'Fictional demo concern with no public citation. Not an observation of this restaurant.' },
      ];
      for (const check of checks) {
        if (state.internalChecks[check.id]) continue;
        state.internalChecks[check.id] = { ...check, locationId: location.id, source: 'Fictional demo check' };
        created += 1;
      }
    }
    return { locations: candidates.map((entry) => entry.location.id), created };
  }, dir);
}
