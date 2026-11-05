'use client';

import { useMemo, useState } from 'react';
import LocationMap from './LocationMap';
import { detailResponses, locationsResponse } from '../lib/fixtures';
import { makeFollowUp, validateFollowUp } from '../lib/followUps';

const emptyForm = { owner: '', dueDate: '', notes: '', status: 'Open', completionNote: '' };

function Badge({ kind, children }) { return <span className={`badge badge-${kind}`}>{children}</span>; }

export default function ManagerWorkspace() {
  const [selectedId, setSelectedId] = useState(null);
  const [activeFinding, setActiveFinding] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [followUps, setFollowUps] = useState(() => Object.fromEntries(Object.entries(detailResponses).map(([id, value]) => [id, value.followUps])));
  const [dismissed, setDismissed] = useState([]);
  const [linked, setLinked] = useState([]);
  const locations = locationsResponse.locations;
  const location = locations.find((item) => item.id === selectedId);
  const detail = selectedId ? detailResponses[selectedId] : null;
  const actions = selectedId ? followUps[selectedId] || [] : [];
  const citations = useMemo(() => detail?.inspections.flatMap((inspection) => inspection.citations.map((citation) => ({ ...citation, inspectionDate: inspection.date }))) || [], [detail]);
  const findings = [...citations.map((item) => ({ id: item.id, type: 'citation', label: `Sample citation ${item.code}` })), ...(detail?.internalChecks || []).map((item) => ({ id: item.id, type: 'check', label: `${item.type} · fictional demo check` }))];

  function selectLocation(id) {
    setSelectedId(id);
    setActiveFinding(null);
    setEditingId(null);
    setErrors({});
    setMessage('');
    requestAnimationFrame(() => document.getElementById('detail-title')?.scrollIntoView({ block: 'start', behavior: 'smooth' }));
  }

  function startAction(finding, existing = null) {
    setActiveFinding(finding);
    setEditingId(existing?.id || null);
    setForm(existing ? { owner: existing.owner, dueDate: existing.dueDate, notes: existing.notes, status: existing.status, completionNote: existing.completionNote || '' } : emptyForm);
    setErrors({});
    setMessage('');
    requestAnimationFrame(() => document.getElementById('action-owner')?.focus());
  }

  function saveAction(event) {
    event.preventDefault();
    const input = { ...form, locationId: selectedId, citationId: activeFinding.type === 'citation' ? activeFinding.id : null, checkId: activeFinding.type === 'check' ? activeFinding.id : null };
    const nextErrors = validateFollowUp(input);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    const result = makeFollowUp(input, editingId || `preview-${Date.now()}`);
    setFollowUps((previous) => ({ ...previous, [selectedId]: editingId ? previous[selectedId].map((item) => item.id === editingId ? result.record : item) : [...previous[selectedId], result.record] }));
    setMessage('Saved in this browser session. Refreshing the page resets preview changes.');
    setActiveFinding(null);
    setEditingId(null);
    requestAnimationFrame(() => document.getElementById('save-message')?.focus());
  }

  return <main className="shell">
    <header className="masthead">
      <div className="brand"><span className="brand-mark" aria-hidden="true">◆</span><span>Food Safety Follow-Up</span></div>
      <span className="header-tag">Manager preview</span>
    </header>
    <div className="preview-banner" role="status"><strong>Interface preview with sample data.</strong> No live NYC inspection feed or saved backend is connected. All locations, citations, checks, and actions shown here are illustrative. Changes reset on refresh.</div>
    <div className="intro"><div><p className="eyebrow">NYC REGION · WORKSPACE</p><h1>Stay ahead of every follow-up.</h1><p>Review findings by location, see what needs attention, and record the next step.</p></div><div className="intro-meta"><span>Data connection</span><strong>Not connected</strong><small>Last successful refresh: unavailable</small></div></div>
    <section className="overview" aria-label="Location overview">
      <div className="section-heading"><div><h2>Locations</h2><p>{locations.length} sample locations · {locationsResponse.importStatus.coverage}</p></div><Badge kind="review">Inspection matches unverified</Badge></div>
      <div className="overview-grid">
        <div className="location-list" aria-label="Sample locations">
          {locations.map((item) => <button type="button" className={`location-row ${selectedId === item.id ? 'selected' : ''}`} aria-current={selectedId === item.id ? 'true' : undefined} key={item.id} onClick={() => selectLocation(item.id)}>
            <span className="location-main"><strong>{item.name}</strong><small>{item.address}</small><span className="row-meta"><span>{item.citationCount} sample citations</span><span>{(followUps[item.id] || []).filter((action) => action.status !== 'Complete').length} open follow-ups</span></span></span>
            <span className="row-end">View</span>
          </button>)}
        </div>
        <div className="map-wrap"><LocationMap locations={locations} selectedId={selectedId} onSelect={selectLocation} /><p className="map-caption">Illustrative positions only. One location has no coordinates and remains in the list.</p></div>
      </div>
    </section>
    {location && <section className="detail" aria-labelledby="detail-title">
      <div className="detail-header"><div><p className="eyebrow">LOCATION REVIEW</p><h2 id="detail-title">{location.name}</h2><p>{location.address}</p></div><Badge kind="review">Inspection match unverified</Badge></div>
      <div className="source-note">Public inspection data is unavailable until a CAMIS match and city-data import are verified. The citation below is a sample fixture, not a current city record.</div>
      <div className="detail-grid">
        <div className="detail-column"><div className="column-title"><h3>Inspection history</h3><Badge kind="public">Public source · sample fixture</Badge></div>
          {detail.inspections.length ? detail.inspections.map((inspection) => <article className="record-card" key={inspection.id}><p className="record-meta">Sample public-data fixture · {inspection.date}</p><h4>{inspection.result}</h4>{inspection.citations.map((citation) => <div className="finding" key={citation.id}><div><strong>Code {citation.code}</strong><p>{citation.description}</p><small>{citation.critical ? 'Marked critical in sample fixture' : 'Sample noncritical citation'}</small></div><button className="text-button" onClick={() => startAction({ id: citation.id, type: 'citation', label: `Sample citation ${citation.code}` })}>Add follow-up</button></div>)}</article>) : <div className="empty-state"><strong>No inspection records available.</strong><p>This is missing sample data, not a no-violation inspection or a verified clean result.</p></div>}
        </div>
        <div className="detail-column"><div className="column-title"><h3>Internal checks</h3><Badge kind="demo">Fictional demo</Badge></div>
          {detail.internalChecks.length ? detail.internalChecks.map((check) => <article className="record-card" key={check.id}><p className="record-meta">Fictional demo check · {check.date}</p><h4>{check.type}</h4><p>{check.note}</p>{check.suggestedCitationId && <div className="suggestion"><strong>Possible relationship to sample code 06D</strong><p>Suggested only because this demo check explicitly names that code. A manager must decide.</p>{linked.includes(check.id) ? <Badge kind="complete">Linked in preview</Badge> : dismissed.includes(check.id) ? <Badge kind="muted">Dismissed in preview</Badge> : <div className="inline-actions"><button className="text-button" onClick={() => setLinked((value) => [...value, check.id])}>Link records</button><button className="text-button" onClick={() => setDismissed((value) => [...value, check.id])}>Dismiss suggestion</button></div>}</div>}<button className="text-button" onClick={() => startAction({ id: check.id, type: 'check', label: `${check.type} · fictional demo check` })}>Add follow-up</button></article>) : <div className="empty-state"><strong>No demo checks for this location.</strong><p>No internal safety conclusion can be drawn.</p></div>}
        </div>
      </div>
      <div className="lower-grid"><section className="subsection"><h3>Needs review</h3>{detail.flags.filter((flag) => !actions.some((action) => action.citationId === flag.citationId)).map((flag) => <article className="flag-card" key={flag.id}><Badge kind="review">Unlinked citation</Badge><p>{flag.reason}</p><button className="text-button" onClick={() => startAction({ id: flag.citationId, type: 'citation', label: 'Sample citation 06D' })}>Create follow-up</button></article>)}{!detail.flags.length && <p className="quiet">No sample flags for this location. This is not a compliance assessment.</p>}</section>
      <section className="subsection"><h3>Follow-ups</h3>{message && <p className="save-message" id="save-message" tabIndex="-1" role="status">{message}</p>}{actions.length ? actions.map((action) => <article className="action-card" key={action.id}><div className="action-top"><Badge kind={action.status === 'Complete' ? 'complete' : action.status === 'In progress' ? 'progress' : 'muted'}>{action.status}</Badge><small>Prototype follow-up</small></div><strong>{action.citationId ? `Sample citation ${citations.find((item) => item.id === action.citationId)?.code || ''}` : detail.internalChecks.find((item) => item.id === action.checkId)?.type}</strong><p>{action.notes}</p><p className="record-meta">Owner: {action.owner} · Due: {action.dueDate}</p>{action.completionNote && <p className="completion">Completion note: {action.completionNote}</p>}<button className="text-button" onClick={() => startAction({ id: action.citationId || action.checkId, type: action.citationId ? 'citation' : 'check', label: action.citationId ? 'Sample citation' : 'Fictional demo check' }, action)}>{action.status === 'Complete' ? 'View or edit' : 'Update follow-up'}</button></article>) : <p className="quiet">No follow-ups in this preview.</p>}</section></div>
      {activeFinding && <section className="form-panel" aria-labelledby="form-title"><div className="form-heading"><div><p className="eyebrow">MANAGER ACTION</p><h3 id="form-title">{editingId ? 'Update follow-up' : 'Create follow-up'}</h3><p>Linked to {activeFinding.label}</p></div><button className="close-button" type="button" onClick={() => { setActiveFinding(null); setErrors({}); }}>Close</button></div><form onSubmit={saveAction} noValidate><div className="form-grid"><label>Action owner<input id="action-owner" value={form.owner} onChange={(event) => setForm({ ...form, owner: event.target.value })} aria-invalid={!!errors.owner} aria-describedby={errors.owner ? 'owner-error' : undefined} />{errors.owner && <small className="error" id="owner-error">{errors.owner}</small>}</label><label>Due date<input type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} aria-invalid={!!errors.dueDate} aria-describedby={errors.dueDate ? 'date-error' : undefined} />{errors.dueDate && <small className="error" id="date-error">{errors.dueDate}</small>}</label><label>Status<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option>Open</option><option>In progress</option><option>Complete</option></select></label></div><label>Action notes<textarea rows="3" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} aria-invalid={!!errors.notes} aria-describedby={errors.notes ? 'notes-error' : undefined} />{errors.notes && <small className="error" id="notes-error">{errors.notes}</small>}</label>{form.status === 'Complete' && <label>Completion note<textarea rows="3" value={form.completionNote} onChange={(event) => setForm({ ...form, completionNote: event.target.value })} aria-invalid={!!errors.completionNote} aria-describedby={errors.completionNote ? 'completion-error' : undefined} />{errors.completionNote && <small className="error" id="completion-error">{errors.completionNote}</small>}</label>}<p className="form-disclaimer">Preview only: this action is held in memory until refresh. No notification is sent.</p><button className="primary-button" type="submit">Save follow-up</button></form></section>}
    </section>}
    <footer>Independent course prototype · No connection to Sweetgreen internal systems</footer>
  </main>;
}
