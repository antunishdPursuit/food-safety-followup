'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { Badge, SourceBadge } from './Badges';
import { usePreview } from './PreviewProvider';
import { citationsFor } from '../lib/records';

export default function ComparisonView() {
  const { id } = useParams();
  const requestedFlag = useSearchParams().get('flag');
  const { locationsResponse, detailResponses, actionsByLocation, suggestions, setSuggestion, saving } = usePreview();
  const location = locationsResponse.locations.find((item) => item.id === id);
  const detail = detailResponses[id];
  if (!location || !detail) return <section className="page-error"><h1>Comparison unavailable</h1><Link href="/">Back to locations</Link></section>;
  const flags = detail.flags;
  const citations = citationsFor(detail);
  const resolvedCitation = citations.find((citation) => `unlinked-${citation.id}` === requestedFlag && actionsByLocation[id].some((action) => action.citationId === citation.id));
  const historicalFlag = resolvedCitation ? {
    id: requestedFlag,
    type: 'Follow-up linked',
    citationIds: [resolvedCitation.id],
    reason: `Code ${resolvedCitation.code} on ${resolvedCitation.inspectionDate} has a linked follow-up. The source record remains visible.`,
  } : null;
  const flag = requestedFlag ? flags.find((item) => item.id === requestedFlag) || historicalFlag : flags[0];
  const visibleFlags = historicalFlag ? [...flags, historicalFlag] : flags;
  const supporting = flag ? citations.filter((citation) => flag.citationIds.includes(citation.id)) : [];
  const suggestedChecks = detail.internalChecks.filter((check) => supporting.some((citation) => citation.id === check.suggestedCitationId));
  const linkedCheck = suggestedChecks.find((check) => suggestions[check.id]?.decision === 'linked');
  const viewTitle = flag?.type === 'Repeat code' ? 'Compare citations' : suggestedChecks.length ? 'Compare citation and demo check' : 'Review citation';
  const viewDescription = flag?.type === 'Repeat code' ? 'Review the citations that produced the repeat-code flag.' : suggestedChecks.length ? 'Review the citation and fictional demo check before deciding whether to link them.' : 'Review the citation behind this flag.';

  return <>
    <nav className="breadcrumbs" aria-label="Breadcrumb"><Link href="/">Locations</Link><span aria-hidden="true">/</span><Link href={`/locations/${id}`}>{location.name}</Link><span aria-hidden="true">/</span><span>{viewTitle}</span></nav>
    <header className="page-heading"><div><p className="eyebrow">RECORD REVIEW</p><h1>{viewTitle}</h1><p>{viewDescription}</p></div></header>
    <div className="source-note"><strong>{location.isSample ? 'Sample evidence only.' : 'Public NYC inspection records.'}</strong> {location.isSample ? 'These citations are fictional fixtures.' : `CAMIS: ${location.camis || 'Unverified'}. Last location refresh: ${location.lastRefreshed ? new Date(location.lastRefreshed).toLocaleString() : 'unavailable'}.`}</div>
    {visibleFlags.length > 1 && <nav className="flag-tabs" aria-label="Choose a flag">{visibleFlags.map((item) => {
      const firstCitation = citations.find((citation) => citation.id === item.citationIds[0]);
      const label = item.type === 'Repeat code' ? `Repeat code ${firstCitation?.code}` : `${item.type} · code ${firstCitation?.code} · ${firstCitation?.inspectionDate}`;
      return <Link key={item.id} aria-current={item.id === flag?.id ? 'page' : undefined} className={item.id === flag?.id ? 'active' : ''} href={`/locations/${id}/compare?flag=${item.id}`}>{label}</Link>;
    })}</nav>}
    {!flag ? <section className="empty-state"><h2>Flag unavailable</h2><p>The supporting findings remain on the location page.</p><Link href={`/locations/${id}`}>Back to location</Link></section> : <div className="compare-layout">
      <section className="comparison-main" aria-labelledby="flag-title"><div className="comparison-reason"><Badge kind="review">{flag.type}</Badge><h2 id="flag-title">Why this is flagged</h2><p>{flag.reason}</p>{flag.type === 'Repeat code' && <p>A repeat flag remains visible even when an earlier follow-up is complete. Each later citation is a separate record.</p>}</div>
        <h2>Citation{supporting.length === 1 ? '' : 's'}</h2><div className="card-grid">{supporting.map((citation) => <article className="record-card" key={citation.id}><p className="record-meta"><SourceBadge source={location.isSample ? "Sample public-data fixture" : "Public NYC inspection"} /> <span>{citation.inspectionDate}</span></p><h3>Code {citation.code}</h3><p>{citation.description}</p><small>{citation.criticalFlag || (citation.critical == null ? 'Critical status unavailable' : citation.critical ? 'Critical' : 'Not critical')}</small></article>)}</div>
        {suggestedChecks.length > 0 && <><h2>Fictional demo check</h2>{suggestedChecks.map((check) => {
          const decision = suggestions[check.id];
          return <article className="record-card demo-card" key={check.id}><p className="record-meta"><SourceBadge source="Fictional demo check" /> <span>{check.date}</span></p><h3>{check.type}</h3><p>{check.note}</p><p>{check.suggestionReason} The records stay separate unless the manager links them.</p>
            {decision ? <p className="decision-history"><Badge kind={decision.decision === 'linked' ? 'complete' : 'muted'}>{decision.decision === 'linked' ? 'Linked by manager' : 'Suggestion dismissed'}</Badge> <span>{new Date(decision.decidedAt).toLocaleString()} · saved decision</span></p> : <div className="inline-actions"><button type="button" className="secondary-button" disabled={saving} onClick={() => setSuggestion(check.id, 'linked', check.suggestedCitationId)}>Link records</button><button type="button" className="text-button" disabled={saving} onClick={() => setSuggestion(check.id, 'dismissed')}>Dismiss suggestion</button></div>}
          </article>;
        })}</>}
      </section>
      <aside className="comparison-side"><h2>Manager decision</h2><p>Public inspection data cannot confirm a correction. Record an action only after reviewing the source and context.</p>{supporting.some((citation) => !citation.historical) && <Link className="primary-button" href={`/locations/${id}/follow-ups/new?citation=${linkedCheck?.suggestedCitationId || supporting.find((citation) => !citation.historical)?.id}${linkedCheck ? `&check=${linkedCheck.id}` : ''}`}>Create follow-up</Link>}<Link className="text-button" href={`/locations/${id}`}>Back to location</Link></aside>
    </div>}
  </>;
}
