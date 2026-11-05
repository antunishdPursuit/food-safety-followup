'use client';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Badge, SourceBadge } from './Badges';
import { usePreview } from './PreviewProvider';
import { citationsFor } from '../lib/flags';
import { validateFollowUp } from '../lib/followUps';

export default function FollowUpView({ mode }) {
  const { id, followUpId } = useParams();
  const search = useSearchParams();
  const router = useRouter();
  const { locationsResponse, detailResponses, actionsByLocation, saveFollowUp, completeFollowUp } = usePreview();
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

  if (!location || !detail || (mode === 'edit' && !existing) || (mode === 'new' && !citation && !check)) {
    return <section className="page-error"><h1>Follow-up unavailable</h1><p>Choose a finding from a location to create or update a follow-up.</p><Link href={location ? `/locations/${id}` : '/'}>Back to location</Link></section>;
  }

  function submit(event) {
    event.preventDefault();
    const input = { ...form, locationId: id, citationId: citation?.id || null, checkId: check?.id || null, completionNote: '' };
    const validation = validateFollowUp(input);
    setErrors(validation);
    if (Object.keys(validation).length) return;
    const result = saveFollowUp(input, existing?.id);
    if (result.errors) { setErrors(result.errors); return; }
    router.push(`/locations/${id}`);
  }

  function finish(note) {
    const result = completeFollowUp(id, existing.id, note);
    if (result.error) return result.error;
    setShowComplete(false);
    router.push(`/locations/${id}`);
    return null;
  }

  return <>
    <nav className="breadcrumbs" aria-label="Breadcrumb"><Link href="/">Locations</Link><span aria-hidden="true">/</span><Link href={`/locations/${id}`}>{location.name}</Link><span aria-hidden="true">/</span><span>{mode === 'new' ? 'New follow-up' : 'Follow-up'}</span></nav>
    <header className="page-heading"><div><p className="eyebrow">MANAGER ACTION</p><h1>{mode === 'new' ? 'Create follow-up' : existing.status === 'Complete' ? 'Completed follow-up' : 'Update follow-up'}</h1><p>Record the next step for this sample finding.</p></div>{existing && <Badge kind={existing.status === 'Complete' ? 'complete' : existing.status === 'In progress' ? 'progress' : 'muted'}>{existing.status}</Badge>}</header>
    <div className="form-layout"><section className="form-context" aria-labelledby="context-title"><h2 id="context-title">Linked {citation && check ? 'findings' : 'finding'}</h2><p><strong>{location.name}</strong><br />{location.address}</p>{citation && <div className="context-finding"><SourceBadge source="Sample public-data fixture" /><h3>Code {citation.code}</h3><p>{citation.description}</p></div>}{check && <div className="context-finding"><SourceBadge source="Fictional demo check" /><h3>{check.type}</h3><p>{check.note}</p></div>}<details><summary>View source record{citation && check ? 's' : ''}</summary>{citation && <p>Sample inspection date: {citation.inspectionDate}. {citation.critical ? 'Marked critical in the sample fixture.' : 'Marked noncritical in the sample fixture.'}</p>}{check && <p>Fictional demo observation date: {check.date}.</p>}</details><p className="quiet">This preview does not contain verified city data or internal records.</p></section>
      <section className="form-main" aria-labelledby="form-title"><h2 id="form-title">{existing?.status === 'Complete' ? 'Recorded action' : 'Action details'}</h2>
        {existing?.status === 'Complete' ? <div className="completed-summary"><p><strong>Owner:</strong> {existing.owner}</p><p><strong>Due:</strong> {existing.dueDate}</p><p><strong>Action:</strong> {existing.notes}</p><p><strong>Completion note:</strong> {existing.completionNote}</p><p><strong>Recorded:</strong> {existing.completedAt ? new Date(existing.completedAt).toLocaleString() : 'Sample fixture'}</p><Link className="secondary-button" href={`/locations/${id}`}>Back to location</Link></div> : <form onSubmit={submit} noValidate>
          <label htmlFor="owner">Action owner</label><input id="owner" value={form.owner} onChange={(event) => setForm({ ...form, owner: event.target.value })} aria-invalid={!!errors.owner} aria-describedby={errors.owner ? 'owner-error' : 'owner-help'} /><small id="owner-help" className="helper">Name or role. This does not notify anyone.</small>{errors.owner && <small id="owner-error" className="error">{errors.owner}</small>}
          <label htmlFor="due-date">Due date</label><input id="due-date" type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} aria-invalid={!!errors.dueDate} aria-describedby={errors.dueDate ? 'date-error' : undefined} />{errors.dueDate && <small id="date-error" className="error">{errors.dueDate}</small>}
          <label htmlFor="notes">Action notes</label><textarea id="notes" rows="5" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} aria-invalid={!!errors.notes} aria-describedby={errors.notes ? 'notes-error' : undefined} />{errors.notes && <small id="notes-error" className="error">{errors.notes}</small>}
          <label htmlFor="status">Status</label><select id="status" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option>Open</option><option>In progress</option></select>
          <p className="form-disclaimer">Preview only: saving holds this action in browser memory until refresh. No notification is sent.</p>
          <div className="form-actions"><button className="primary-button" type="submit">Save follow-up</button>{existing && <button className="secondary-button" type="button" ref={completeButton} disabled={hasUnsavedEdits} onClick={() => setShowComplete(true)}>Mark complete…</button>}<Link className="text-button" href={`/locations/${id}`}>Cancel</Link></div>{hasUnsavedEdits && <p className="form-disclaimer">Save these edits before marking the follow-up complete.</p>}
        </form>}
      </section>
    </div>
    {showComplete && <CompleteDialog onClose={() => { setShowComplete(false); completeButton.current?.focus(); }} onFinish={finish} />}
  </>;
}

function CompleteDialog({ onClose, onFinish }) {
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const noteRef = useRef(null);
  const dialogRef = useRef(null);
  useEffect(() => {
    noteRef.current?.focus();
    function handleKey(event) {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab') {
        const controls = [...dialogRef.current.querySelectorAll('button,textarea')];
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);
  return <div className="dialog-backdrop"><div className="complete-dialog" role="dialog" aria-modal="true" aria-labelledby="complete-title" ref={dialogRef}><h2 id="complete-title">Mark follow-up complete</h2><p>City data cannot confirm a correction. Your note records what was done in this preview.</p><label htmlFor="completion-note">Completion note</label><textarea id="completion-note" ref={noteRef} rows="4" value={note} onChange={(event) => setNote(event.target.value)} aria-invalid={!!error} aria-describedby={error ? 'completion-error' : undefined} />{error && <small className="error" id="completion-error">{error}</small>}<div className="form-actions"><button type="button" className="primary-button" onClick={() => setError(onFinish(note) || '')}>Record completion</button><button type="button" className="secondary-button" onClick={onClose}>Cancel</button></div></div></div>;
}
