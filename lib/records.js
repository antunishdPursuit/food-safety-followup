// Presentation only: the API owns flags, counts and current-record eligibility.
export function citationsFor(detail) {
  return detail.inspections.flatMap((inspection) => inspection.citations.map((citation) => ({
    ...citation, inspectionId: inspection.id, inspectionDate: inspection.date,
    sourceUrl: inspection.sourceUrl,
    historical: Boolean(inspection.previousPermit || inspection.removedFromSource || citation.removedFromSource),
  })));
}
