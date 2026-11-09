'use client';

import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { createApiClient } from '../lib/api';

const PreviewContext = createContext(null);
const api = createApiClient();

export function PreviewProvider({ children }) {
  const { id } = useParams();
  const [locationsResponse, setLocations] = useState(null);
  const [detailResponses, setDetails] = useState({});
  const [resourceError, setResourceError] = useState(null);
  const [revision, setRevision] = useState(0);
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const writePending = useRef(false);
  const readVersion = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    const version = readVersion.current;
    setResourceError(null);
    Promise.all([api.locations(controller.signal), id ? api.location(id, controller.signal) : null])
      .then(([list, detail]) => {
        if (controller.signal.aborted || version !== readVersion.current) return;
        setLocations(list);
        if (detail) setDetails((previous) => ({ ...previous, [id]: detail }));
      }).catch((error) => {
        if (!controller.signal.aborted && version === readVersion.current) setResourceError({ id, message: error.message || 'Records could not be loaded. Please try again.', status: error.status });
      });
    return () => controller.abort();
  }, [id, revision]);

  async function refresh(locationId) {
    const [list, detail] = await Promise.all([api.locations(), api.location(locationId)]);
    setLocations(list);
    setDetails((previous) => ({ ...previous, [locationId]: detail }));
  }

  async function write(locationId, operation, update, message) {
    if (writePending.current) return { errors: { form: 'A save is already in progress.' } };
    writePending.current = true;
    readVersion.current += 1;
    setSaving(true);
    try {
      const record = await operation();
      setDetails((previous) => update(previous, record));
      setNotice(message);
      try { await refresh(locationId); }
      catch { setNotice(message + ' The latest summary could not be loaded. Use Reload data to retry.'); }
      return { record };
    } catch (error) {
      return { errors: Object.keys(error.fields || {}).length ? error.fields : { form: error.message || 'The save could not be completed. Please try again.' } };
    } finally {
      writePending.current = false;
      setSaving(false);
    }
  }

  function saveFollowUp(input, existingId) {
    return write(input.locationId, () => api.saveFollowUp(input, existingId), (previous, record) => {
      const detail = previous[input.locationId];
      return { ...previous, [input.locationId]: { ...detail, followUps: existingId ? detail.followUps.map((item) => item.id === existingId ? record : item) : [...detail.followUps, record] } };
    }, 'Follow-up saved.');
  }

  async function completeFollowUp(locationId, actionId, completionNote) {
    const result = await saveFollowUp({ locationId, status: 'Complete', completionNote }, actionId);
    return result.errors ? { error: result.errors.completionNote || result.errors.form || Object.values(result.errors)[0] } : result;
  }

  async function setSuggestion(checkId, decision, citationId) {
    const result = await write(id, () => api.setCheckLink(checkId, decision, citationId), (previous, record) => ({
      ...previous, [id]: { ...previous[id], internalChecks: previous[id].internalChecks.map((check) => check.id === checkId ? record : check) },
    }), decision === 'linked' ? 'Records linked.' : 'Suggestion dismissed.');
    if (result.errors) setNotice(Object.values(result.errors)[0]);
    return result;
  }

  const actionsByLocation = Object.fromEntries(Object.entries(detailResponses).map(([key, detail]) => [key, detail.followUps]));
  const suggestions = Object.fromEntries(Object.values(detailResponses).flatMap((detail) => detail.internalChecks.filter((check) => check.link).map((check) => [check.id, check.link])));
  return <PreviewContext.Provider value={{
    locationsResponse, detailResponses, actionsByLocation, suggestions, notice, saving,
    loading: !locationsResponse || Boolean(id && !detailResponses[id]),
    error: resourceError?.id === id ? resourceError : null,
    reload: () => { setResourceError(null); setRevision((value) => value + 1); },
    setNotice, saveFollowUp, completeFollowUp, setSuggestion,
  }}>{children}</PreviewContext.Provider>;
}

export function usePreview() {
  const value = useContext(PreviewContext);
  if (!value) throw new Error('PreviewProvider is required.');
  return value;
}
