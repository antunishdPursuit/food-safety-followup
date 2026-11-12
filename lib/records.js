// Presentation only: the API owns flags, counts and current-record eligibility.
export function citationsFor(detail) {
  return detail.inspections.flatMap((inspection) => inspection.citations.map((citation) => ({
    ...citation, inspectionId: inspection.id, inspectionDate: inspection.date,
    sourceUrl: inspection.sourceUrl,
    historical: Boolean(inspection.previousPermit || inspection.removedFromSource || citation.removedFromSource),
  })));
}

// Date grouping never changes a record's current-source or historical status.
export function inspectionTimeline(inspections) {
  const ordered = [...inspections].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const groups = new Map();
  for (const inspection of ordered) {
    const year = /^\d{4}-\d{2}-\d{2}$/.test(inspection.date || '') ? inspection.date.slice(0, 4) : 'Date unavailable';
    if (!groups.has(year)) groups.set(year, []);
    groups.get(year).push(inspection);
  }
  return {
    years: [...groups].map(([year, records]) => ({ year, records })),
    latest: ordered.find((inspection) => !inspection.previousPermit && !inspection.removedFromSource && inspection.outcome !== 'not-yet-inspected'),
  };
}

// The note an inspection card shows above its citations. The card always lists every stored citation, because a
// refresh that turns an inspection into "no violations" keeps old citations that saved follow-ups or links still use.
export function inspectionNotice(inspection) {
  if (inspection.outcome === 'no-violations') return 'no-violations';
  if (inspection.citations.length) return null;
  return inspection.outcome === 'not-yet-inspected' ? 'not-yet-inspected' : 'details-unavailable';
}

// Group returned review flags for display without changing their IDs, reasons or eligibility.
export function reviewGroups(detail) {
  const citations = new Map(citationsFor(detail).map((citation) => [citation.id, citation]));
  const groups = new Map();
  for (const flag of detail.flags) {
    const citation = citations.get(flag.citationIds[0]);
    const key = flag.type === 'Needs review' && citation ? citation.inspectionId : flag.id;
    if (!groups.has(key)) groups.set(key, { id: key, date: citation?.inspectionDate, type: flag.type, flags: [] });
    groups.get(key).flags.push(flag);
  }
  return [...groups.values()];
}

export function comparisonChecks(detail, supporting) {
  const ids = new Set(supporting.map((citation) => citation.id));
  return detail.internalChecks.filter((check) => ids.has(check.suggestedCitationId) || (check.link?.decision === 'linked' && ids.has(check.link.citationId)));
}

export function nextActionCitation(supporting, actions) {
  return supporting.find((citation) => !citation.historical && !actions.some((action) => action.citationId === citation.id)) || supporting.find((citation) => !citation.historical);
}

export function checkReviewTarget(check) {
  return check.link?.decision === 'linked' ? check.link.citationId : check.suggestedCitationId;
}

export function savedRecordFlag(detail, requestedFlag) {
  if (detail.flags.some((flag) => flag.id === requestedFlag)) return null;
  const citation = citationsFor(detail).find((item) => `unlinked-${item.id}` === requestedFlag && (
    detail.followUps.some((action) => action.citationId === item.id) ||
    detail.internalChecks.some((check) => check.link?.decision === 'linked' && check.link.citationId === item.id)
  ));
  return citation ? { id: requestedFlag, type: 'Manager record linked', citationIds: [citation.id], reason: `Code ${citation.code} on ${citation.inspectionDate} has a saved manager link. The source record remains visible.` } : null;
}
