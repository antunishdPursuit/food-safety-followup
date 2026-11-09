import { promises as fs } from 'node:fs';
import path from 'node:path';
import { dataDir } from './config.js';
import { allCitations, currentInspections } from './rules.js';
import { readDb, updateDb } from './store.js';

const DAY = 24 * 3600 * 1000;
const isoDate = (date) => date.toISOString().slice(0, 10);

// The kind of check follows the citation's own description, so a temperature check is never paired with a pest finding.
function checkTypeFor(description) {
  if (/temperature|\bheld\b/i.test(description)) return 'Temperature check';
  if (/\b(mice|mouse|rats?|roach\w*|flies|vermin|rodent\w*)\b/i.test(description)) return 'Pest activity check';
  return 'Audit';
}

// Adds a small, clearly fictional mix of internal checks to verified locations that already have city citations.
// One check explicitly references the violation code of the location's most recent citation, so it can suggest a
// match for the manager to link or dismiss. The walkthrough has no citation. Nothing is invented about the
// restaurant: both notes say they are fictional. Existing checks are never changed, so re-running is safe.
export async function seedDemoChecks({ dir, count = 3, now = new Date() } = {}) {
  const db = await readDb(dir);
  const candidates = Object.values(db.locations)
    .filter((location) => !location.delisted && location.matchStatus === 'verified')
    .map((location) => ({ location, citations: allCitations(currentInspections(db.inspections[location.id] || []).sort((a, b) => (b.date || '').localeCompare(a.date || ''))) }))
    .filter((entry) => entry.citations.length)
    .sort((a, b) => b.citations.length - a.citations.length || a.location.id.localeCompare(b.location.id))
    .slice(0, count);

  return updateDb((state) => {
    let created = 0;
    for (const { location, citations } of candidates) {
      const type = checkTypeFor(citations[0].description);
      const checks = [
        { id: `demo-${location.id}-coded`, date: isoDate(new Date(now - 14 * DAY)), type, note: `Fictional demo ${type.toLowerCase()} entry for interface testing. Not a reading or observation from this restaurant.`, citationCode: citations[0].code },
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

// Clears what a rehearsal leaves behind: follow-ups and the manager's link or dismiss decisions. Locations, city
// records, and demo checks stay. A copy of the whole store is saved first, so nothing is lost for good.
export async function resetManagerState({ dir = dataDir(), now = new Date() } = {}) {
  const db = await readDb(dir);
  const counts = { followUps: Object.keys(db.followUps).length, decisions: Object.keys(db.links).length };
  if (!counts.followUps && !counts.decisions) return { ...counts, backup: null };
  const backupDir = path.join(dir, 'backups');
  await fs.mkdir(backupDir, { recursive: true });
  // No colons in the file name: Windows does not allow them.
  const backup = path.join(backupDir, `db-${now.toISOString().replace(/[:.]/g, '-')}.json`);
  await fs.copyFile(path.join(dir, 'db.json'), backup);
  await updateDb((state) => { state.followUps = {}; state.links = {}; }, dir);
  return { ...counts, backup };
}
