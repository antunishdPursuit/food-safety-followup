export function citationsFor(detail) {
  return detail.inspections.flatMap((inspection) =>
    inspection.citations.map((citation) => ({ ...citation, inspectionId: inspection.id, inspectionDate: inspection.date }))
  );
}

export function flagsFor(detail, actions) {
  const citations = citationsFor(detail);
  const unlinked = citations.filter((citation) =>
    !actions.some((action) => action.citationId === citation.id)
  ).map((citation) => ({
    id: `unlinked-${citation.id}`,
    type: 'Needs review',
    citationIds: [citation.id],
    reason: `Sample code ${citation.code} on ${citation.inspectionDate} has no linked follow-up in this preview. This does not establish whether action was taken elsewhere.`,
  }));
  const repeats = [];
  const byCode = new Map();
  for (const citation of citations) {
    byCode.set(citation.code, [...(byCode.get(citation.code) || []), citation]);
  }
  for (const [code, sameCode] of byCode) {
    const dates = [...new Set(sameCode.map((citation) => citation.inspectionDate))].sort();
    if (dates.length > 1) repeats.push({
      id: `repeat-${code}`,
      type: 'Repeat code',
      citationIds: sameCode.map((citation) => citation.id),
      reason: `Sample code ${code} appears on ${dates.join(' and ')} at this sample location. These are fictional fixture rows, not verified city records.`,
    });
  }
  return [...unlinked, ...repeats];
}
