'use client';

import { createContext, useContext, useState } from 'react';
import { detailResponses, locationsResponse } from '../lib/fixtures';
import { makeFollowUp } from '../lib/followUps';

const PreviewContext = createContext(null);

export function PreviewProvider({ children }) {
  const [actionsByLocation, setActionsByLocation] = useState(() =>
    Object.fromEntries(Object.entries(detailResponses).map(([id, detail]) => [id, detail.followUps]))
  );
  const [suggestions, setSuggestions] = useState({});
  const [notice, setNotice] = useState('');

  function saveFollowUp(input, existingId) {
    const result = makeFollowUp(input, existingId || `preview-${crypto.randomUUID()}`);
    if (result.errors) return result;
    setActionsByLocation((previous) => ({
      ...previous,
      [input.locationId]: existingId
        ? previous[input.locationId].map((action) => action.id === existingId ? result.record : action)
        : [...previous[input.locationId], result.record],
    }));
    setNotice('Follow-up saved for this browser session. Changes reset on refresh.');
    return result;
  }

  function completeFollowUp(locationId, actionId, completionNote) {
    if (!completionNote.trim()) return { error: 'Add a completion note.' };
    const current = actionsByLocation[locationId]?.find((action) => action.id === actionId);
    if (!current) return { error: 'Follow-up not found.' };
    const completed = { ...current, status: 'Complete', completionNote: completionNote.trim(), completedAt: new Date().toISOString() };
    setActionsByLocation((previous) => ({
      ...previous,
      [locationId]: previous[locationId].map((action) => action.id === actionId ? completed : action),
    }));
    setNotice('Completion recorded for this browser session. Changes reset on refresh.');
    return { record: completed };
  }

  function setSuggestion(checkId, decision) {
    setSuggestions((previous) => ({ ...previous, [checkId]: { decision, decidedAt: new Date().toISOString() } }));
    setNotice(decision === 'linked' ? 'Records linked for this browser session.' : 'Suggestion dismissed for this browser session.');
  }

  return <PreviewContext.Provider value={{
    locationsResponse, detailResponses, actionsByLocation, suggestions, notice,
    setNotice, saveFollowUp, completeFollowUp, setSuggestion,
  }}>{children}</PreviewContext.Provider>;
}

export function usePreview() {
  const value = useContext(PreviewContext);
  if (!value) throw new Error('PreviewProvider is required.');
  return value;
}
