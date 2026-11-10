'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Badge, SourceBadge } from './Badges';
import { usePreview } from './PreviewProvider';
import { citationsFor, reviewGroups, checkReviewTarget, inspectionTimeline } from '../lib/records';

export default function LocationDetail() {
  const { id } = useParams();
  const { locationsResponse, detailResponses, actionsByLocation, suggestions } = usePreview();
  const location = locationsResponse.locations.find((item) => item.id === id);
  const detail = detailResponses[id];
  if (!location || !detail) return <section className="page-error"><h1>Location unavailable</h1><p>This location ID is not available.</p><Link href="/locations">Back to locations</Link></section>;

  const actions = actionsByLocation[id];
  const flags = detail.flags;
  const { years, latest } = inspectionTimeline(detail.inspections);
  const latestCitations = latest?.citations.filter((citation) => !citation.removedFromSource).length;
  const active = actions.filter((action) => action.status !== 'Complete');
  const complete = actions.filter((action) => action.status === 'Complete');
  const pendingPermit = !location.isSample && location.matchStatus !== 'verified';
  const canCreateFollowUp = citationsFor(detail).some((citation) => !citation.historical) || detail.internalChecks.length > 0;

  return <>
    <nav className="breadcrumbs" aria-label="Breadcrumb"><Link href="/locations">Locations</Link><span aria-hidden="true">/</span><span>{location.name}</span></nav>
    <header className="page-heading"><div><p className="eyebrow">LOCATION REVIEW</p><h1>{location.name}</h1><p>{location.address}</p></div><Badge kind={location.matchStatus === 'verified' ? 'complete' : 'review'}>{location.isSample ? 'Sample location' : location.matchStatus === 'verified' ? `Verified CAMIS ${location.camis}` : 'Inspection match unverified'}</Badge></header>
    {(location.isSample || location.lastRefreshed) ? <div className="source-note"><strong>{location.isSample ? 'Sample records.' : detail.importStatus.source.name + '.'}</strong> {location.lastRefreshed && `Last successful location refresh: ${new Date(location.lastRefreshed).toLocaleString()}.`} {location.coordinatesSource && `Pin source: ${location.coordinatesSource}.`}</div> : location.coordinatesSource && <details className="source-note"><summary>Map source</summary><p>{location.coordinatesSource}</p></details>}
    {latest && <div className="location-metrics inspection-summary"><div><span>Latest available inspection</span><strong>{latest.date || 'Date unavailable'}</strong></div><div><strong>{latestCitations}</strong><span>citations in that inspection</span></div><div><strong>{active.length}</strong><span>open follow-ups in this workspace</span></div></div>}
    {(years.length > 0 || detail.internalChecks.length === 0) && <p className="quiet history-note">{years.length > 0 && 'Inspection dates describe past observations. City records do not supply earlier manager follow-ups or confirm whether a finding was corrected. '}{detail.internalChecks.length === 0 && 'Company internal checks are not supplied; this does not mean none were performed.'}</p>}

    <div className="location-layout">
      <section className="page-section inspection-history" aria-labelledby="inspections-title"><div className="column-title"><h2 id="inspections-title">Inspection history</h2><SourceBadge source={location.isSample ? 'Sample public-data fixture' : 'Public NYC inspection'} /></div>
        {pendingPermit && years.length > 0 && <p className="quiet">Permit confirmation is needed before new city inspections can be imported. Retained records and saved follow-ups remain available.</p>}
        {years.length ? years.map(({ year, records }, index) => <details className="inspection-year" key={year} open={latest?.date ? year === latest.date.slice(0, 4) : index === 0}>
          <summary><strong>{year}</strong><span>{records.length} {records.length === 1 ? 'inspection' : 'inspections'} · {records.reduce((count, record) => count + record.citations.length, 0)} recorded citations</span></summary>
          {records.map((inspection) => <InspectionRecord key={inspection.id} inspection={inspection} location={location} />)}
        </details>) : <div className="empty-state"><strong>{location.isSample ? 'No sample inspections available' : pendingPermit ? 'Permit confirmation pending' : location.dataState === 'not-imported' ? 'Inspection import pending' : 'No inspection records available'}</strong><p>{location.isSample ? 'This fictional fixture has no inspection records. Missing records are different from an inspection with no violations.' : pendingPermit ? 'Confirm this location’s permit before importing city inspections. This is a data-matching step, not a safety rating.' : location.dataState === 'not-imported' ? 'The confirmed permit has not been imported yet.' : 'No records returned in the last import. Missing records do not mean an inspection found no violations.'}</p></div>}
      </section>
      <aside className="location-sidebar">
        <section className="page-section" aria-labelledby="followups-title"><h2 id="followups-title">Follow-ups</h2><p className="quiet">Saved in this workspace. No owner is notified.</p>
          {active.length ? active.map((action) => <ActionCard key={action.id} action={action} detail={detail} locationId={id} />) : <p className="quiet">No open follow-ups recorded here.{canCreateFollowUp && ' Choose a finding to record the next step.'}</p>}
          {complete.length > 0 && <details className="completed-actions"><summary>Completed follow-ups ({complete.length})</summary>{complete.map((action) => <ActionCard key={action.id} action={action} detail={detail} locationId={id} />)}</details>}
        </section>
        {detail.internalChecks.length > 0 && <section className="page-section" aria-labelledby="checks-title"><h2 id="checks-title">Internal records</h2>
          {detail.internalChecks.map((check) => <article className="record-card demo-card" key={check.id}><p className="record-meta"><SourceBadge source="Fictional demo check" /><span>{check.date}</span></p><h3>{check.type}</h3><p>{check.note}</p>{(check.suggestedCitationId || check.link) && <p className="suggestion-summary"><Badge kind={suggestions[check.id]?.decision === 'linked' ? 'complete' : suggestions[check.id]?.decision === 'dismissed' ? 'muted' : 'review'}>{suggestions[check.id]?.decision === 'linked' ? 'Linked by manager' : suggestions[check.id]?.decision === 'dismissed' ? 'Suggestion dismissed' : 'Suggested relationship'}</Badge>{checkReviewTarget(check) && <Link href={`/locations/${id}/compare?flag=unlinked-${checkReviewTarget(check)}`}>Review records</Link>}</p>}<Link className="text-button" href={`/locations/${id}/follow-ups/new?check=${check.id}`}>Create follow-up</Link></article>)}
        </section>}
      </aside>
    </div>
    {flags.length > 0 && <details className="page-section secondary-review"><summary>Review prompts and repeated codes ({flags.length})</summary><div className="section-heading"><div><h2 id="attention-title">Supporting-record review</h2><p>Findings grouped by inspection. A prompt is not proof that no action occurred elsewhere.</p></div></div>
      <div className="card-grid">{reviewGroups(detail).map((group) => {
        const flag = group.flags[0];
        const hasDemoMatch = detail.internalChecks.some((check) => flag.citationIds.includes(check.suggestedCitationId));
        const linkLabel = flag.type === 'Repeat code' ? 'Compare citations' : hasDemoMatch ? 'Compare citation and demo check' : 'Review citation';
        if (group.flags.length > 1) return <article className="flag-card" key={group.id}><Badge kind="review">Needs review</Badge><h3>{group.date || 'Date unavailable'}</h3><p>{group.flags.length} citations without a linked follow-up. This does not establish whether action occurred elsewhere.</p><details><summary>Review {group.flags.length} findings</summary><ul>{group.flags.map((item) => <li key={item.id}><p>{item.reason}</p><Link href={`/locations/${id}/compare?flag=${item.id}`}>Review supporting record</Link></li>)}</ul></details></article>;
        return <article className="flag-card" key={group.id}><Badge kind="review">{flag.type}</Badge><p>{flag.reason}</p><Link className="text-button" href={`/locations/${id}/compare?flag=${flag.id}`}>{linkLabel}</Link></article>;
      })}</div>
    </details>}

    {detail.regionalSignals.length > 0 && <section className="page-section" aria-labelledby="regional-title"><h2 id="regional-title">Regional signals</h2><p className="quiet">Same codes across verified locations in the last {detail.regionalWindow.months} months (since {detail.regionalWindow.since}). A shared code does not establish a shared cause.</p><div className="card-grid">{detail.regionalSignals.slice(0, 5).map((signal) => <RegionalCard key={signal.id} signal={signal} />)}</div>{detail.regionalSignals.length > 5 && <details><summary>Show {detail.regionalSignals.length - 5} more regional signals</summary><div className="card-grid">{detail.regionalSignals.slice(5).map((signal) => <RegionalCard key={signal.id} signal={signal} />)}</div></details>}</section>}
  </>;
}

function InspectionRecord({ inspection, location }) {
  const history = inspection.previousPermit || inspection.removedFromSource;
  return <article className="record-card inspection-record">
    <header><h3>{inspection.date || 'Date unavailable'} · {inspection.type}</h3><p className="record-meta"><SourceBadge source={location.isSample ? 'Sample public-data fixture' : 'Public NYC inspection'} /> Grade {inspection.grade || 'not stated'} · Score {inspection.score ?? 'not stated'}</p>{history && <Badge kind="muted">Historical record · {inspection.previousPermit ? 'previous permit' : 'removed from source'}</Badge>}</header>
    {!inspection.citations.length && inspection.outcome !== 'no-violations' && <p>{inspection.outcome === 'not-yet-inspected' ? 'The city record indicates not yet inspected.' : 'No citation details available; this is not a no-violation result.'}</p>}
    {inspection.outcome === 'no-violations' ? <p>No violations recorded in this inspection. This does not confirm current compliance.</p> : inspection.citations.map((citation) => <div className="finding" key={citation.id}>
      <div><strong>Code {citation.code}</strong><p>{citation.description}</p><Badge kind={citation.critical ? 'review' : 'muted'}>{citation.criticalFlag || (citation.critical == null ? 'Critical status unavailable' : citation.critical ? 'Critical' : 'Not critical')}</Badge></div>
      {history || citation.removedFromSource ? <Badge kind="muted">History · no new follow-up</Badge> : <Link className="secondary-button" href={`/locations/${location.id}/follow-ups/new?citation=${citation.id}`}>Create follow-up</Link>}
    </div>)}
    <details className="inspection-source"><summary>View source details</summary><p>{inspection.result}</p><p className="record-meta">{location.isSample ? 'Sample public-data fixture' : inspection.source || 'Public NYC inspection'} · Action: {inspection.action || 'Not stated'} · Grade date: {inspection.gradeDate || 'Unavailable'} · Record date: {inspection.recordDate || 'Unavailable'}</p>{inspection.sourceUrl && <a href={inspection.sourceUrl} target="_blank" rel="noreferrer">City dataset</a>}</details>
  </article>;
}

function ActionCard({ action, detail, locationId }) {
  const citation = citationsFor(detail).find((item) => item.id === action.citationId);
  const check = detail.internalChecks.find((item) => item.id === action.checkId);
  return <article className="action-card"><div className="action-top"><SourceBadge source="Prototype follow-up" /><span className="status-group"><Badge kind={action.status === 'Complete' ? 'complete' : action.status === 'In progress' ? 'progress' : 'muted'}>{action.status}</Badge>{action.overdue && <Badge kind="overdue">Overdue</Badge>}</span></div><h3>{citation ? `Citation ${citation.code}` : check?.type || 'Linked finding'}{citation && check ? ` + ${check.type}` : ''}</h3><p>{action.notes}</p><p className="record-meta">Owner: {action.owner} · Due: {action.dueDate}</p>{action.completionNote && <p className="completion">Completed {action.completedAt ? new Date(action.completedAt).toLocaleString() : 'in the sample fixture'} · {action.completionNote}</p>}<Link className="text-button" href={`/locations/${locationId}/follow-ups/${action.id}`}>{action.status === 'Complete' ? 'View follow-up' : 'Update follow-up'}</Link></article>;
}


function RegionalCard({ signal }) {
  return <article className="record-card"><SourceBadge source="Public NYC inspection" /><h3>Code {signal.code} · {signal.locationCount} locations</h3><p>{signal.description}</p><p>{signal.reason}</p><details><summary>Covered locations</summary><ul>{signal.locations.map((location) => <li key={location.id}><Link href={`/locations/${location.id}`}>{location.name}</Link> · {location.lastDate} · {location.citationCount} citations</li>)}</ul></details></article>;
}
