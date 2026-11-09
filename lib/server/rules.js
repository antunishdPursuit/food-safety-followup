// Comparison rules. Everything here reads records and returns explanations; nothing changes a record, and nothing
// treats missing data as proof of compliance or of action taken.

const CITY_SOURCE = 'Public NYC inspection';

export function allCitations(inspections) {
  return inspections.flatMap((inspection) => inspection.citations.map((citation) => ({
    ...citation,
    inspectionId: inspection.id,
    inspectionDate: inspection.date,
    inspectionType: inspection.type,
    source: inspection.source,
  })));
}

// The inspections that describe the permit a location shows now. Findings kept as history stay out of every count,
// flag, regional signal, and suggestion: those from a previous permit (previousPermit) and those the city no longer
// lists (removedFromSource, kept only because a follow-up or decision points at them).
export function currentInspections(inspections) {
  return inspections
    .filter((inspection) => !inspection.previousPermit && !inspection.removedFromSource)
    .map((inspection) => (inspection.citations.some((citation) => citation.removedFromSource)
      ? { ...inspection, citations: inspection.citations.filter((citation) => !citation.removedFromSource) }
      : inspection));
}

const kind = (citation) => (citation.source === CITY_SOURCE ? 'City' : 'Sample');

// A demo check may suggest a citation only from an explicit reference: a stored citation id (sample fixtures)
// or an explicit violation code, which resolves to the most recent citation with that code at the location.
export function suggestionFor(check, citations) {
  if (check.suggestedCitationId && citations.some((citation) => citation.id === check.suggestedCitationId)) {
    return { citationId: check.suggestedCitationId, reason: 'The demo check references this citation directly.' };
  }
  if (check.citationCode) {
    const match = citations.find((citation) => citation.code === check.citationCode);
    if (match) return { citationId: match.id, reason: `The demo check explicitly references violation code ${check.citationCode}.` };
  }
  return null;
}

// Adds the suggestion and the manager's decision to each stored check. `citations` must be newest first.
export function describeChecks(checks, links, citations) {
  return checks.map((check) => {
    const suggestion = suggestionFor(check, citations);
    const { citationCode, suggestedCitationId, ...visible } = check;
    return {
      ...visible,
      ...(suggestion ? { suggestedCitationId: suggestion.citationId, suggestionReason: suggestion.reason } : {}),
      link: links[check.id] ? { decision: links[check.id].decision, citationId: links[check.id].citationId, decidedAt: links[check.id].decidedAt } : null,
    };
  });
}

// The citation a check currently points at: the one the manager linked, else the suggestion, never a dismissed one.
function pointedCitation(check) {
  if (check.link) return check.link.decision === 'linked' ? check.link.citationId : null;
  return check.suggestedCitationId || null;
}

export function computeFlags(inspections, followUps, checks = []) {
  const citations = allCitations(inspections);
  const unlinked = citations
    .filter((citation) => !followUps.some((followUp) => followUp.citationId === citation.id))
    .map((citation) => ({
      id: `unlinked-${citation.id}`,
      type: 'Needs review',
      citationIds: [citation.id],
      checkIds: checks.filter((check) => pointedCitation(check) === citation.id).map((check) => check.id),
      reason: `${kind(citation)} citation ${citation.code} on ${citation.inspectionDate} has no linked follow-up in this prototype. This does not establish whether action was taken elsewhere.`,
    }));

  const byCode = new Map();
  for (const citation of citations) byCode.set(citation.code, [...(byCode.get(citation.code) || []), citation]);
  const repeats = [];
  for (const [code, sameCode] of byCode) {
    const dates = [...new Set(sameCode.map((citation) => citation.inspectionDate))].sort();
    if (dates.length < 2) continue;
    repeats.push({
      id: `repeat-${code}`,
      type: 'Repeat code',
      citationIds: sameCode.map((citation) => citation.id),
      checkIds: [],
      reason: `${kind(sameCode[0])} violation code ${code} appears on ${dates.join(' and ')} at this location. A repeat means the same code on different inspection dates; it does not show whether the cause was addressed.${sameCode[0].source === CITY_SOURCE ? '' : ' These are fixture rows, not verified city records.'}`,
    });
  }
  return [...unlinked, ...repeats];
}

// The same violation code at two or more covered locations. A separate regional signal, never merged into a location's flags.
export function regionalSignalsFor(locationId, entries) {
  const byCode = new Map();
  for (const { location, inspections } of entries) {
    for (const citation of allCitations(inspections)) {
      const found = byCode.get(citation.code) || { code: citation.code, descriptions: new Map(), locations: new Map() };
      found.descriptions.set(citation.description, (found.descriptions.get(citation.description) || 0) + 1);
      const place = found.locations.get(location.id) || { id: location.id, name: location.name, citationCount: 0, lastDate: null };
      place.citationCount += 1;
      if (!place.lastDate || citation.inspectionDate > place.lastDate) place.lastDate = citation.inspectionDate;
      found.locations.set(location.id, place);
      byCode.set(citation.code, found);
    }
  }
  return [...byCode.values()]
    .filter((found) => found.locations.has(locationId) && found.locations.size >= 2)
    .map((found) => {
      const [description] = [...found.descriptions.entries()].sort((a, b) => b[1] - a[1])[0];
      const locations = [...found.locations.values()].sort((a, b) => b.citationCount - a.citationCount || a.name.localeCompare(b.name));
      return {
        id: `regional-${found.code}`,
        type: 'Cross-location pattern',
        code: found.code,
        description,
        locationCount: locations.length,
        locations,
        reason: `Violation code ${found.code} appears at ${locations.length} covered locations. This is a regional signal; it does not say the locations share a cause.`,
      };
    })
    .sort((a, b) => b.locationCount - a.locationCount || a.code.localeCompare(b.code));
}
