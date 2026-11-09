// Presentation only: the API owns flags, counts and current-record eligibility.
export function citationsFor(detail) {
  return detail.inspections.flatMap((inspection) => inspection.citations.map((citation) => ({
    ...citation, inspectionId: inspection.id, inspectionDate: inspection.date,
    sourceUrl: inspection.sourceUrl,
    historical: Boolean(inspection.previousPermit || inspection.removedFromSource || citation.removedFromSource),
  })));
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
