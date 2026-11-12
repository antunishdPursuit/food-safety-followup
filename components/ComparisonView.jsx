'use client';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Badge, SourceBadge } from './Badges';
import SourceDetails from './SourceDetails';
import { usePreview } from './PreviewProvider';
import { citationsFor, comparisonChecks, nextActionCitation, savedRecordFlag, locationFor } from '../lib/records';
import { formatDate, formatTimestamp, formatDateMentions } from '../lib/presentation';

export default function ComparisonView() {
  const { id } = useParams();
  const router = useRouter();
  const requestedFlag = useSearchParams().get('flag');
  const { locationsResponse, detailResponses, actionsByLocation, suggestions, setSuggestion, saving } = usePreview();
  const detail = detailResponses[id];
  const location = locationFor(locationsResponse, detail, id);
  if (!location || !detail) return <section className="page-error"><h1>Comparison unavailable</h1><Link href="/locations">Back to locations</Link></section>;
  const flags = detail.flags;
  const citations = citationsFor(detail);
  const historicalFlag = savedRecordFlag(detail, requestedFlag);
  const flag = requestedFlag ? flags.find((item) => item.id === requestedFlag) || historicalFlag : flags[0];
  const visibleFlags = historicalFlag ? [...flags, historicalFlag] : flags;
  const supporting = flag ? citations.filter((citation) => flag.citationIds.includes(citation.id)) : [];
  const suggestedChecks = comparisonChecks(detail, supporting);
  const actionCitation = nextActionCitation(supporting, actionsByLocation[id]);
  const linkedCheck = suggestedChecks.find((check) => check.link?.decision === 'linked' && check.link.citationId === actionCitation?.id);
  const viewTitle = flag?.type === 'Repeat code' ? 'Compare citations' : suggestedChecks.length ? 'Compare citation and demo check' : 'Review citation';
  const viewDescription = flag?.type === 'Repeat code' ? 'Review the citations behind this repeated code.' : suggestedChecks.length ? 'Review the citation and fictional check before linking records.' : 'Review the citation behind this prompt.';

  return <>
    <nav className="breadcrumbs" aria-label="Breadcrumb"><Link href="/locations">Locations</Link><span aria-hidden="true">/</span><Link href={`/locations/${id}`}>{location.name}</Link><span aria-hidden="true">/</span><span>{viewTitle}</span></nav>
    <header className="page-heading"><div><h1>{viewTitle}</h1><p>{viewDescription}</p></div></header>
    <SourceDetails location={location} sourceName={detail.importStatus.source.name} />
    {visibleFlags.length > 1 && <div className="flag-selector"><label htmlFor="flag-selector">Choose a review prompt ({visibleFlags.length})</label><select id="flag-selector" value={flag?.id || ''} onChange={(event) => router.push(`/locations/${id}/compare?flag=${encodeURIComponent(event.target.value)}`)}>{!flag && <option value="" disabled>Choose an available review prompt</option>}{visibleFlags.map((item) => {
      const firstCitation = citations.find((citation) => citation.id === item.citationIds[0]);
      const label = item.type === 'Repeat code' ? `Repeat code ${firstCitation?.code}` : `${item.type} · code ${firstCitation?.code} · ${formatDate(firstCitation?.inspectionDate)}`;
      return <option key={item.id} value={item.id}>{label}</option>;
    })}</select></div>}
    {!flag ? <section className="empty-state"><h2>Review prompt unavailable</h2><p>The supporting findings remain on the location page.</p><Link href={`/locations/${id}`}>Back to location</Link></section> : <div className="compare-layout">
      <section className="comparison-main" aria-labelledby="flag-title"><div className="comparison-reason"><Badge kind="review">{flag.type}</Badge><h2 id="flag-title">Why review this</h2><p>{formatDateMentions(flag.reason)}</p>{flag.type === 'Repeat code' && <p>A repeat prompt stays visible after earlier follow-ups are complete. Each later citation is a separate record.</p>}</div>
        <h2>Citation{supporting.length === 1 ? '' : 's'}</h2><div className="card-grid">{supporting.map((citation) => <article className="record-card" key={citation.id}><p className="record-meta"><SourceBadge source={location.isSample ? "Sample public-data fixture" : "Public NYC inspection"} /> <span>{formatDate(citation.inspectionDate)}</span></p><h3>Code {citation.code}</h3><p>{citation.description}</p>{citation.historical && <p><Badge kind="muted">Historical record</Badge> Retained for saved manager records; no new action can be created.</p>}{citation.sourceUrl && <p><a href={citation.sourceUrl} target="_blank" rel="noreferrer">View city dataset</a></p>}<small>{citation.criticalFlag || (citation.critical == null ? 'Critical status unavailable' : citation.critical ? 'Critical' : 'Not critical')}</small></article>)}</div>
        {suggestedChecks.length > 0 && <><h2>Fictional demo check</h2>{suggestedChecks.map((check) => {
          const decision = suggestions[check.id];
          const linkedCitation = decision?.decision === 'linked' ? citations.find((citation) => citation.id === decision.citationId) : null;
          return <article className="record-card demo-card" key={check.id}><p className="record-meta"><SourceBadge source="Fictional demo check" /> <span>{formatDate(check.date)}</span></p><h3>{check.type}</h3><p>{check.note}</p><p>{check.suggestionReason} The records stay separate unless the manager links them.</p>{linkedCitation && <div className="context-finding"><p><strong>Saved link:</strong> code {linkedCitation.code} · {formatDate(linkedCitation.inspectionDate)}{linkedCitation.historical ? ' · historical record' : ''}</p><p>{linkedCitation.description}</p><SourceBadge source={location.isSample ? "Sample public-data fixture" : "Public NYC inspection"} /></div>}
            {decision ? <p className="decision-history"><Badge kind={decision.decision === 'linked' ? 'complete' : 'muted'}>{decision.decision === 'linked' ? 'Linked by manager' : 'Suggestion dismissed'}</Badge> <span>{formatTimestamp(decision.decidedAt)} · saved decision</span></p> : <div className="inline-actions"><button type="button" className="secondary-button" disabled={saving} onClick={() => setSuggestion(check.id, 'linked', check.suggestedCitationId)}>Link records</button><button type="button" className="text-button" disabled={saving} onClick={() => setSuggestion(check.id, 'dismissed')}>Dismiss suggestion</button></div>}
          </article>;
        })}</>}
      </section>
      <aside className="comparison-side"><h2>Manager decision</h2><p>Public inspection data cannot confirm a correction. Record an action only after reviewing the source and context.</p>{actionCitation && <Link className="primary-button" href={`/locations/${id}/follow-ups/new?citation=${actionCitation.id}${linkedCheck ? `&check=${linkedCheck.id}` : ''}`}>Create follow-up</Link>}<Link className="text-button" href={`/locations/${id}`}>Back to location</Link></aside>
    </div>}
  </>;
}
