'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Badge, SourceBadge } from './Badges';
import { usePreview } from './PreviewProvider';
import { citationsFor, reviewGroups, checkReviewTarget } from '../lib/records';

export default function LocationDetail() {
  const { id } = useParams();
  const { locationsResponse, detailResponses, actionsByLocation, suggestions } = usePreview();
  const location = locationsResponse.locations.find((item) => item.id === id);
  const detail = detailResponses[id];
  if (!location || !detail) return <section className="page-error"><h1>Location unavailable</h1><p>This location ID is not available.</p><Link href="/">Back to locations</Link></section>;

  const actions = actionsByLocation[id];
  const flags = detail.flags;
  const citations = citationsFor(detail);
  const active = actions.filter((action) => action.status !== 'Complete');
  const complete = actions.filter((action) => action.status === 'Complete');

  return <>
    <nav className="breadcrumbs" aria-label="Breadcrumb"><Link href="/">Locations</Link><span aria-hidden="true">/</span><span>{location.name}</span></nav>
    <header className="page-heading"><div><p className="eyebrow">LOCATION REVIEW</p><h1>{location.name}</h1><p>{location.address}</p></div><Badge kind={location.matchStatus === 'verified' ? 'complete' : 'review'}>{location.isSample ? 'Sample location' : location.matchStatus === 'verified' ? `Verified CAMIS ${location.camis}` : 'Inspection match unverified'}</Badge></header>
    <div className="source-note"><strong>{location.isSample ? 'Sample records.' : detail.importStatus.source.name + '.'}</strong> Last successful location refresh: {location.lastRefreshed ? new Date(location.lastRefreshed).toLocaleString() : 'unavailable'}. {location.matchStatus !== 'verified' && !location.isSample && 'Inspection match unverified; no city safety conclusion can be drawn.'} {location.coordinatesSource && `Pin source: ${location.coordinatesSource}.`}</div>
    <div className="location-metrics"><div><strong>{flags.length}</strong><span>flags</span></div><div><strong>{active.length}</strong><span>active follow-ups</span></div><div><strong>{location.citationCount ?? 'Unavailable'}</strong><span>current citations</span></div></div>

    <section className="page-section" aria-labelledby="attention-title"><div className="section-heading"><div><h2 id="attention-title">Needs attention</h2><p>Current findings, grouped by inspection. A flag is a prompt to review, not proof that no action occurred elsewhere.</p></div></div>
      {flags.length ? <div className="card-grid">{reviewGroups(detail).map((group) => {
        const flag = group.flags[0];
        const hasDemoMatch = detail.internalChecks.some((check) => flag.citationIds.includes(check.suggestedCitationId));
        const linkLabel = flag.type === 'Repeat code' ? 'Compare citations' : hasDemoMatch ? 'Compare citation and demo check' : 'Review citation';
        if (group.flags.length > 1) return <article className="flag-card" key={group.id}><Badge kind="review">Needs review</Badge><h3>{group.date || 'Date unavailable'}</h3><p>{group.flags.length} citations without a linked follow-up. This does not establish whether action occurred elsewhere.</p><details><summary>Review {group.flags.length} findings</summary><ul>{group.flags.map((item) => <li key={item.id}><p>{item.reason}</p><Link href={`/locations/${id}/compare?flag=${item.id}`}>Review supporting record</Link></li>)}</ul></details></article>;
        return <article className="flag-card" key={group.id}><Badge kind="review">{flag.type}</Badge><p>{flag.reason}</p><Link className="text-button" href={`/locations/${id}/compare?flag=${flag.id}`}>{linkLabel}</Link></article>;
      })}</div> : <div className="empty-state"><strong>No flags in the available current records.</strong><p>This is not a compliance assessment.</p></div>}
    </section>

    <section className="page-section" aria-labelledby="followups-title"><div className="section-heading"><div><h2 id="followups-title">Active follow-ups</h2><p>Manager-entered prototype actions. No owner is notified.</p></div></div>
      {active.length ? <div className="card-grid">{active.map((action) => <ActionCard key={action.id} action={action} detail={detail} locationId={id} />)}</div> : <div className="empty-state"><strong>No active follow-ups.</strong><p>Choose a finding below to create one.</p></div>}
    </section>

    <div className="detail-grid detail-sections">
      <section className="detail-column" aria-labelledby="inspections-title"><div className="column-title"><h2 id="inspections-title">Inspection history</h2><SourceBadge source={location.isSample ? "Sample public-data fixture" : "Public NYC inspection"} /></div>
        {detail.inspections.length ? detail.inspections.map((inspection) => <article className="record-card" key={inspection.id}><p className="record-meta"><SourceBadge source={location.isSample ? "Sample public-data fixture" : "Public NYC inspection"} /> <span>{inspection.date || 'Date unavailable'} · {inspection.type}</span></p><h3>{inspection.result}</h3>{(inspection.previousPermit || inspection.removedFromSource) && <Badge kind="muted">Historical record</Badge>}<p className="record-meta">Action: {inspection.action || 'Not stated'} · Score: {inspection.score ?? 'Not stated'} · Grade: {inspection.grade || 'Not stated'} · Grade date: {inspection.gradeDate || 'Unavailable'} · Record date: {inspection.recordDate || 'Unavailable'}</p>{inspection.sourceUrl && <p><a href={inspection.sourceUrl} target="_blank" rel="noreferrer">City dataset</a></p>}
          {!inspection.citations.length && inspection.outcome !== 'no-violations' && <p>{inspection.outcome === 'not-yet-inspected' ? 'The city record indicates not yet inspected.' : 'No citation details available; this is not a no-violation result.'}</p>}
          {inspection.outcome === 'no-violations' ? <p>No violations recorded in this inspection. This does not confirm current compliance.</p> : inspection.citations.map((citation) => <div className="finding" key={citation.id}><div><strong>Code {citation.code}</strong><p>{citation.description}</p><small>{citation.criticalFlag || (citation.critical == null ? 'Critical status unavailable' : citation.critical ? 'Critical' : 'Not critical')}</small></div>{inspection.previousPermit || inspection.removedFromSource || citation.removedFromSource ? <Badge kind="muted">History · no new follow-up</Badge> : <Link className="text-button" href={`/locations/${id}/follow-ups/new?citation=${citation.id}`}>Create follow-up</Link>}</div>)}
        </article>) : <div className="empty-state"><strong>No inspection records available.</strong><p>{location.dataState === 'unmatched' ? 'Inspection match unverified.' : location.dataState === 'not-imported' ? 'The matched permit has not been imported.' : 'No records returned in the last import.'} Missing data is different from an inspection with no violations.</p></div>}
      </section>
      <section className="detail-column" aria-labelledby="checks-title"><div className="column-title"><h2 id="checks-title">Internal checks</h2>{detail.internalChecks.length > 0 && <SourceBadge source="Fictional demo check" />}</div>
        {detail.internalChecks.length ? detail.internalChecks.map((check) => <article className="record-card demo-card" key={check.id}><p className="record-meta"><SourceBadge source="Fictional demo check" /> <span>{check.date}</span></p><h3>{check.type}</h3><p>{check.note}</p>{(check.suggestedCitationId || check.link) && <p className="suggestion-summary"><Badge kind={suggestions[check.id]?.decision === 'linked' ? 'complete' : suggestions[check.id]?.decision === 'dismissed' ? 'muted' : 'review'}>{suggestions[check.id]?.decision === 'linked' ? 'Linked by manager' : suggestions[check.id]?.decision === 'dismissed' ? 'Suggestion dismissed' : 'Suggested relationship'}</Badge> {checkReviewTarget(check) && <Link href={`/locations/${id}/compare?flag=unlinked-${checkReviewTarget(check)}`}>Review records</Link>}</p>}<Link className="text-button" href={`/locations/${id}/follow-ups/new?check=${check.id}`}>Create follow-up</Link></article>) : <div className="empty-state"><strong>No internal checks available.</strong><p>No company internal system is connected. This does not imply that checks were not performed.</p></div>}
      </section>
    </div>

    <section className="page-section" aria-labelledby="regional-title"><h2 id="regional-title">Regional signals</h2><p className="quiet">Same codes across verified locations in the last {detail.regionalWindow.months} months (since {detail.regionalWindow.since}). A shared code does not establish a shared cause.</p>{detail.regionalSignals.length ? <><div className="card-grid">{detail.regionalSignals.slice(0, 5).map((signal) => <RegionalCard key={signal.id} signal={signal} />)}</div>{detail.regionalSignals.length > 5 && <details><summary>Show {detail.regionalSignals.length - 5} more regional signals</summary><div className="card-grid">{detail.regionalSignals.slice(5).map((signal) => <RegionalCard key={signal.id} signal={signal} />)}</div></details>}</> : <p>No cross-location signals in the available records for this window.</p>}</section>
    <section className="page-section" aria-labelledby="completed-title"><h2 id="completed-title">Completed follow-ups</h2>{complete.length ? <div className="card-grid">{complete.map((action) => <ActionCard key={action.id} action={action} detail={detail} locationId={id} />)}</div> : <p className="quiet">No completed follow-ups.</p>}</section>
  </>;
}

function ActionCard({ action, detail, locationId }) {
  const citation = citationsFor(detail).find((item) => item.id === action.citationId);
  const check = detail.internalChecks.find((item) => item.id === action.checkId);
  return <article className="action-card"><div className="action-top"><SourceBadge source="Prototype follow-up" /><span className="status-group"><Badge kind={action.status === 'Complete' ? 'complete' : action.status === 'In progress' ? 'progress' : 'muted'}>{action.status}</Badge>{action.overdue && <Badge kind="overdue">Overdue</Badge>}</span></div><h3>{citation ? `Citation ${citation.code}` : check?.type || 'Linked finding'}{citation && check ? ` + ${check.type}` : ''}</h3><p>{action.notes}</p><p className="record-meta">Owner: {action.owner} · Due: {action.dueDate}</p>{action.completionNote && <p className="completion">Completed {action.completedAt ? new Date(action.completedAt).toLocaleString() : 'in the sample fixture'} · {action.completionNote}</p>}<Link className="text-button" href={`/locations/${locationId}/follow-ups/${action.id}`}>{action.status === 'Complete' ? 'View follow-up' : 'Update follow-up'}</Link></article>;
}


function RegionalCard({ signal }) {
  return <article className="record-card"><SourceBadge source="Public NYC inspection" /><h3>Code {signal.code} · {signal.locationCount} locations</h3><p>{signal.description}</p><p>{signal.reason}</p><details><summary>Covered locations</summary><ul>{signal.locations.map((location) => <li key={location.id}><Link href={`/locations/${location.id}`}>{location.name}</Link> · {location.lastDate} · {location.citationCount} citations</li>)}</ul></details></article>;
}
