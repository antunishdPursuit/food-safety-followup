import { currentInspections } from './rules.js';

// A dated summary of what the store holds, so every total quoted in a message or pull request can be traced to one
// output (npm run data:status). History (a previous permit, or findings the city no longer lists) is counted apart.
export function summarizeStore(db, now = new Date()) {
  const listed = Object.values(db.locations).filter((location) => !location.delisted);
  const verified = listed.filter((location) => location.matchStatus === 'verified');
  const confirmedByManager = verified.filter((location) => location.confirmedByManager).length;
  const state = (name) => listed.filter((location) => location.matchStatus === name).length;

  let inspections = 0;
  let citations = 0;
  let historyCitations = 0;
  for (const location of listed) {
    const all = db.inspections[location.id] || [];
    const current = currentInspections(all);
    const currentCitationCount = current.reduce((sum, inspection) => sum + inspection.citations.length, 0);
    inspections += current.length;
    citations += currentCitationCount;
    historyCitations += all.reduce((sum, inspection) => sum + inspection.citations.length, 0) - currentCitationCount;
  }
  return {
    checkedAt: now.toISOString(),
    locations: listed.length,
    verified: verified.length,
    verifiedAutomatically: verified.length - confirmedByManager,
    confirmedByManager,
    candidates: state('candidate'),
    unverified: state('unverified'),
    inspections,
    citations,
    historyCitations,
    lastSuccess: db.importStatus.lastSuccess,
    lastAttempt: db.importStatus.lastAttempt,
    error: db.importStatus.error,
  };
}
