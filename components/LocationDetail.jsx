'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Badge, SourceBadge } from './Badges';
import { usePreview } from './PreviewProvider';
import { citationsFor, flagsFor } from '../lib/flags';
import { isOverdue } from '../lib/followUps';

export default function LocationDetail() {
  const { id } = useParams();
  const { locationsResponse, detailResponses, actionsByLocation, suggestions, notice } = usePreview();
  const location = locationsResponse.locations.find((item) => item.id === id);
  const detail = detailResponses[id];
  if (!location || !detail) return <section className="page-error"><h1>Location unavailable</h1><p>This location ID is not in the preview.</p><Link href="/">Back to locations</Link></section>;

  const actions = actionsByLocation[id];
  const flags = flagsFor(detail, actions);
  const citations = citationsFor(detail);
  const active = actions.filter((action) => action.status !== 'Complete');
  const complete = actions.filter((action) => action.status === 'Complete');

  return <>
    <nav className="breadcrumbs" aria-label="Breadcrumb"><Link href="/">Locations</Link><span aria-hidden="true">/</span><span>{location.name}</span></nav>
    <header className="page-heading"><div><p className="eyebrow">LOCATION REVIEW</p><h1>{location.name}</h1><p>{location.address}</p></div><Badge kind="review">Inspection match unverified</Badge></header>
    <div className="source-note"><strong>City data is not connected.</strong> A CAMIS match and import have not been verified. The public-data examples below are fixtures, not current city records. Last successful refresh: unavailable.</div>
    {notice && <p className="save-message" role="status">{notice}</p>}
    <div className="location-metrics"><div><strong>{flags.length}</strong><span>sample flags</span></div><div><strong>{active.length}</strong><span>active follow-ups</span></div><div><strong>{citations.length}</strong><span>sample citations</span></div></div>

    <section className="page-section" aria-labelledby="attention-title"><div className="section-heading"><div><h2 id="attention-title">Needs attention</h2><p>Rules applied to sample records only. A flag is a prompt to review, not proof that no action occurred elsewhere.</p></div></div>
      {flags.length ? <div className="card-grid">{flags.map((flag) => {
        const hasDemoMatch = detail.internalChecks.some((check) => flag.citationIds.includes(check.suggestedCitationId));
        const linkLabel = flag.type === 'Repeat code' ? 'Compare two sample citations' : hasDemoMatch ? 'Compare sample citation and demo check' : 'Review sample citation';
        return <article className="flag-card" key={flag.id}><Badge kind="review">{flag.type}</Badge><p>{flag.reason}</p><Link className="text-button" href={`/locations/${id}/compare?flag=${flag.id}`}>{linkLabel}</Link></article>;
      })}</div> : <div className="empty-state"><strong>No flags in this sample view.</strong><p>This is not a compliance assessment.</p></div>}
    </section>

    <section className="page-section" aria-labelledby="followups-title"><div className="section-heading"><div><h2 id="followups-title">Active follow-ups</h2><p>Manager-entered prototype actions. No owner is notified from this preview.</p></div></div>
      {active.length ? <div className="card-grid">{active.map((action) => <ActionCard key={action.id} action={action} detail={detail} locationId={id} />)}</div> : <div className="empty-state"><strong>No active follow-ups in this preview.</strong><p>Choose a finding below to create one.</p></div>}
    </section>

    <div className="detail-grid detail-sections">
      <section className="detail-column" aria-labelledby="inspections-title"><div className="column-title"><h2 id="inspections-title">Inspection history</h2><SourceBadge source="Sample public-data fixture" /></div>
        {detail.inspections.length ? detail.inspections.map((inspection) => <article className="record-card" key={inspection.id}><p className="record-meta"><SourceBadge source="Sample public-data fixture" /> <span>{inspection.date} · {inspection.type}</span></p><h3>{inspection.result}</h3>
          {inspection.outcome === 'no-violations' ? <p>No violations recorded in this sample inspection. This is not a live NYC result.</p> : inspection.citations.map((citation) => <div className="finding" key={citation.id}><div><strong>Code {citation.code}</strong><p>{citation.description}</p><small>{citation.critical ? 'Critical in sample fixture' : 'Noncritical in sample fixture'}</small></div><Link className="text-button" href={`/locations/${id}/follow-ups/new?citation=${citation.id}`}>Create follow-up</Link></div>)}
        </article>) : <div className="empty-state"><strong>No inspection records available.</strong><p>Missing data is different from an inspection with no violations.</p></div>}
      </section>
      <section className="detail-column" aria-labelledby="checks-title"><div className="column-title"><h2 id="checks-title">Internal checks</h2><SourceBadge source="Fictional demo check" /></div>
        {detail.internalChecks.length ? detail.internalChecks.map((check) => <article className="record-card demo-card" key={check.id}><p className="record-meta"><SourceBadge source="Fictional demo check" /> <span>{check.date}</span></p><h3>{check.type}</h3><p>{check.note}</p>{check.suggestedCitationId && <p className="suggestion-summary"><Badge kind={suggestions[check.id]?.decision === 'linked' ? 'complete' : suggestions[check.id]?.decision === 'dismissed' ? 'muted' : 'review'}>{suggestions[check.id]?.decision === 'linked' ? 'Linked in preview' : suggestions[check.id]?.decision === 'dismissed' ? 'Suggestion dismissed' : 'Suggested relationship'}</Badge> <Link href={`/locations/${id}/compare?flag=unlinked-${check.suggestedCitationId}`}>Review the sample citation</Link></p>}<Link className="text-button" href={`/locations/${id}/follow-ups/new?check=${check.id}`}>Create follow-up</Link></article>) : <div className="empty-state"><strong>No demo checks for this location.</strong><p>No internal safety conclusion can be drawn.</p></div>}
      </section>
    </div>

    <section className="page-section" aria-labelledby="regional-title"><h2 id="regional-title">Regional signals</h2><p className="quiet">No cross-location signal is available in this sample dataset. A regional pattern requires verified location matches and source records.</p></section>
    <section className="page-section" aria-labelledby="completed-title"><h2 id="completed-title">Completed follow-ups</h2>{complete.length ? <div className="card-grid">{complete.map((action) => <ActionCard key={action.id} action={action} detail={detail} locationId={id} />)}</div> : <p className="quiet">No completed follow-ups in this preview.</p>}</section>
  </>;
}

function ActionCard({ action, detail, locationId }) {
  const citation = citationsFor(detail).find((item) => item.id === action.citationId);
  const check = detail.internalChecks.find((item) => item.id === action.checkId);
  return <article className="action-card"><div className="action-top"><SourceBadge source="Prototype follow-up" /><span className="status-group"><Badge kind={action.status === 'Complete' ? 'complete' : action.status === 'In progress' ? 'progress' : 'muted'}>{action.status}</Badge>{isOverdue(action) && <Badge kind="overdue">Overdue</Badge>}</span></div><h3>{citation ? `Sample citation ${citation.code}` : check?.type || 'Linked finding'}{citation && check ? ` + ${check.type}` : ''}</h3><p>{action.notes}</p><p className="record-meta">Owner: {action.owner} · Due: {action.dueDate}</p>{action.completionNote && <p className="completion">Completed {action.completedAt ? new Date(action.completedAt).toLocaleString() : 'in the sample fixture'} · {action.completionNote}</p>}<Link className="text-button" href={`/locations/${locationId}/follow-ups/${action.id}`}>{action.status === 'Complete' ? 'View follow-up' : 'Update follow-up'}</Link></article>;
}
