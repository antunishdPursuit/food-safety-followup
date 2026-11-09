// A dated summary of what the store holds, so every total quoted in a message or pull request can be traced to one
// output (npm run data:status). History kept from a previous permit is counted apart from current records.
export function summarizeStore(db, now = new Date()) {
  const listed = Object.values(db.locations).filter((location) => !location.delisted);
  const verified = listed.filter((location) => location.matchStatus === 'verified');
  const confirmedByManager = verified.filter((location) => location.confirmedByManager).length;
  const state = (name) => listed.filter((location) => location.matchStatus === name).length;

  let inspections = 0;
  let citations = 0;
  let historyCitations = 0;
  for (const location of listed) {
    for (const inspection of db.inspections[location.id] || []) {
      if (inspection.previousPermit) historyCitations += inspection.citations.length;
      else {
        inspections += 1;
        citations += inspection.citations.length;
      }
    }
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
