'use client';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Badge, SourceBadge } from './Badges';
import { usePreview } from './PreviewProvider';
import { citationsFor } from '../lib/records';
import { validateFollowUp } from '../lib/followUps';

export default function FollowUpView({ mode }) {
  const { id, followUpId } = useParams();
  const search = useSearchParams();
  const router = useRouter();
  const { locationsResponse, detailResponses, actionsByLocation, saveFollowUp, completeFollowUp, saving } = usePreview();
  const location = locationsResponse.locations.find((item) => item.id === id);
  const detail = detailResponses[id];
  const existing = mode === 'edit' ? actionsByLocation[id]?.find((item) => item.id === followUpId) : null;
  const citationId = mode === 'edit' ? existing?.citationId : search.get('citation');
  const checkId = mode === 'edit' ? existing?.checkId : search.get('check');
  const citation = detail && citationsFor(detail).find((item) => item.id === citationId);
  const check = detail?.internalChecks.find((item) => item.id === checkId);
  const [form, setForm] = useState(() => ({ owner: existing?.owner || '', dueDate: existing?.dueDate || '', notes: existing?.notes || '', status: existing?.status || 'Open' }));
  const [errors, setErrors] = useState({});
  const [showComplete, setShowComplete] = useState(false);
  const completeButton = useRef(null);
  const hasUnsavedEdits = existing && (form.owner !== existing.owner || form.dueDate !== existing.dueDate || form.notes !== existing.notes || form.status !== existing.status);

  if (!location || !detail || (mode === 'edit' && !existing) || (mode === 'new' && ((!citation && !check) || citation?.historical))) {
    return <section className="page-error"><h1>Follow-up unavailable</h1><p>Choose a finding from a location to create or update a follow-up.</p><Link href={location ? `/locations/${id}` : '/locations'}>Back to location</Link></section>;
  }

  async function submit(event) {
    event.preventDefault();
    const input = { ...form, locationId: id, citationId: citation?.id || null, checkId: check?.id || null, completionNote: '' };
    const validation = validateFollowUp(input);
    setErrors(validation);
    if (Object.keys(validation).length) return;
    const result = await saveFollowUp(input, existing?.id);
    if (result.errors) { setErrors(result.errors); return; }
    router.push(`/locations/${id}`);
  }

  async function finish(note) {
    const result = await completeFollowUp(id, existing.id, note);
    if (result.error) return result.error;
    setShowComplete(false);
    router.push(`/locations/${id}`);
    return null;
  }

  return <>
    <nav className="breadcrumbs" aria-label="Breadcrumb"><Link href="/locations">Locations</Link><span aria-hidden="true">/</span><Link href={`/locations/${id}`}>{location.name}</Link><span aria-hidden="true">/</span><span>{mode === 'new' ? 'New follow-up' : 'Follow-up'}</span></nav>
    <header className="page-heading"><div><h1>{mode === 'new' ? 'Create follow-up' : existing.status === 'Complete' ? 'Completed follow-up' : 'Update follow-up'}</h1></div>{existing && <Badge kind={existing.status === 'Complete' ? 'complete' : existing.status === 'In progress' ? 'progress' : 'muted'}>{existing.status}</Badge>}</header>
    <div className="form-layout"><SourceContext location={location} citation={citation} check={check} />
      <section className="form-main" aria-label="Follow-up details">
        {existing?.status === 'Complete' ? <div className="completed-summary"><p><strong>Owner:</strong> {existing.owner}</p><p><strong>Due:</strong> {existing.dueDate}</p><p><strong>Action:</strong> {existing.notes}</p><p><strong>Completion note:</strong> {existing.completionNote}</p><p><strong>Recorded:</strong> {existing.completedAt ? new Date(existing.completedAt).toLocaleString() : 'Sample fixture'}</p><Link className="secondary-button" href={`/locations/${id}`}>Back to location</Link></div> : <form onSubmit={submit} noValidate aria-busy={saving}><fieldset disabled={saving} className="action-fields">{Object.keys(errors).some((key) => !['owner', 'dueDate', 'notes'].includes(key)) && <p className="error" role="alert">{Object.entries(errors).filter(([key]) => !['owner', 'dueDate', 'notes'].includes(key)).map(([, value]) => value).join(' ')}</p>}
          <label htmlFor="owner">Action owner</label><input id="owner" placeholder="Name or role" value={form.owner} onChange={(event) => setForm({ ...form, owner: event.target.value })} aria-invalid={!!errors.owner} aria-describedby={errors.owner ? 'owner-error' : undefined} />{errors.owner && <small id="owner-error" className="error">{errors.owner}</small>}
          <label htmlFor="due-date">Due date</label><input id="due-date" type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} aria-invalid={!!errors.dueDate} aria-describedby={errors.dueDate ? 'date-error' : undefined} />{errors.dueDate && <small id="date-error" className="error">{errors.dueDate}</small>}
          <label htmlFor="notes">Action</label><textarea id="notes" placeholder="Describe the next step" rows="5" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} aria-invalid={!!errors.notes} aria-describedby={errors.notes ? 'notes-error' : undefined} />{errors.notes && <small id="notes-error" className="error">{errors.notes}</small>}
          <label htmlFor="status">Status</label><select id="status" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option>Open</option><option>In progress</option></select>
          <p className="form-disclaimer">Saving a follow-up does not notify its owner.</p>
          <div className="form-actions"><button className="primary-button" type="submit">{saving ? 'Saving…' : 'Save follow-up'}</button>{existing && <button className="secondary-button" type="button" ref={completeButton} disabled={hasUnsavedEdits} onClick={() => setShowComplete(true)}>Mark complete…</button>}<Link className="text-button" href={`/locations/${id}`}>Cancel</Link></div>{hasUnsavedEdits && <p className="form-disclaimer">Save these edits before marking the follow-up complete.</p>}
        </fieldset></form>}
      </section>
    </div>
    {showComplete && <CompleteDialog saving={saving} onClose={() => { setShowComplete(false); completeButton.current?.focus(); }} onFinish={finish} />}
  </>;
}

function SourceContext({ location, citation, check }) {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    const narrow = window.matchMedia('(max-width: 600px)');
    const update = () => setOpen(!narrow.matches);
    update();
    narrow.addEventListener('change', update);
    return () => narrow.removeEventListener('change', update);
  }, []);
  return <details className="form-context source-context" open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
    <summary>Source {citation && check ? 'findings' : 'finding'}</summary>
    <p className="source-location"><strong>{location.name}</strong><br />{location.address}</p>
    {citation && <div className="context-finding"><SourceBadge source={location.isSample ? 'Sample public-data fixture' : 'NYC inspection record'} /><p className="record-meta">Inspection: {citation.inspectionDate || 'Date unavailable'}</p><h3>Code {citation.code}</h3><p>{citation.description}</p><Badge kind={citation.critical ? 'review' : 'muted'}>{citation.criticalFlag || (citation.critical == null ? 'Critical status unavailable' : citation.critical ? 'Critical' : 'Not critical')}</Badge>{citation.historical && <p className="quiet">Historical finding. Existing saved work remains editable.</p>}{citation.sourceUrl && <p><a href={citation.sourceUrl} target="_blank" rel="noreferrer">View city source</a></p>}</div>}
    {check && <div className="context-finding"><SourceBadge source="Fictional demo check" /><p className="record-meta">Observation: {check.date}</p><h3>{check.type}</h3><p>{check.note}</p></div>}
  </details>;
}

function CompleteDialog({ onClose, onFinish, saving }) {
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const noteRef = useRef(null);
  const dialogRef = useRef(null);
  useEffect(() => {
    noteRef.current?.focus();
    function handleKey(event) {
      if (event.key === 'Escape' && !saving) onClose();
      if (event.key === 'Tab') {
        const controls = [...dialogRef.current.querySelectorAll('button:not(:disabled),textarea:not(:disabled)')];
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose, saving]);
  return <div className="dialog-backdrop"><div className="complete-dialog" role="dialog" aria-modal="true" aria-labelledby="complete-title" ref={dialogRef}><h2 id="complete-title">Mark follow-up complete</h2><p>City data cannot confirm a correction. Your note records the action taken.</p><label htmlFor="completion-note">Completion note</label><textarea id="completion-note" ref={noteRef} rows="4" value={note} onChange={(event) => setNote(event.target.value)} aria-invalid={!!error} aria-describedby={error ? 'completion-error' : undefined} />{error && <small className="error" id="completion-error">{error}</small>}<div className="form-actions"><button type="button" className="primary-button" disabled={saving} onClick={async () => setError(await onFinish(note) || '')}>Record completion</button><button type="button" className="secondary-button" disabled={saving} onClick={onClose}>Cancel</button></div></div></div>;
}
