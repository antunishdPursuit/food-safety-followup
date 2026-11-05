// Fictional records used only to exercise the manager interface.
export const locationsResponse = {
  source: 'Sample location fixture',
  importStatus: { state: 'not-connected', lastSuccess: null, coverage: '0 of 3 sample locations verified' },
  locations: [
    { id: 'sample-midtown', name: 'Sample Midtown location', address: 'Illustrative NYC address', coordinates: [40.754, -73.983], camis: null, matchStatus: 'unverified', citationCount: 2, openFollowUpCount: 1 },
    { id: 'sample-downtown', name: 'Sample Downtown location', address: 'Illustrative NYC address', coordinates: [40.715, -74.008], camis: null, matchStatus: 'unverified', citationCount: 0, openFollowUpCount: 0 },
    { id: 'sample-queens', name: 'Sample Queens location', address: 'Illustrative NYC address · coordinates unavailable', coordinates: null, camis: null, matchStatus: 'unverified', citationCount: 0, openFollowUpCount: 0 },
  ],
};

export const detailResponses = {
  'sample-midtown': {
    locationId: 'sample-midtown',
    inspections: [
      { id: 'inspection-1', date: '2026-09-18', source: 'Sample public-data fixture', result: 'Sample citations', citations: [
        { id: 'citation-1', code: '06D', description: 'Illustrative food-contact surface finding', critical: true },
        { id: 'citation-2', code: '10F', description: 'Illustrative equipment finding', critical: false },
      ] },
    ],
    internalChecks: [
      { id: 'check-1', date: '2026-09-20', type: 'Temperature check', note: 'Fictional observation for interface testing.', source: 'Fictional demo check', suggestedCitationId: 'citation-1' },
      { id: 'check-2', date: '2026-09-21', type: 'Walkthrough', note: 'Fictional concern without a public citation.', source: 'Fictional demo check' },
    ],
    followUps: [
      { id: 'followup-1', locationId: 'sample-midtown', citationId: 'citation-2', checkId: null, owner: 'Manager', dueDate: '2026-11-15', notes: 'Sample action for interface testing.', status: 'Open', completionNote: '' },
    ],
    flags: [
      { id: 'flag-1', type: 'Unlinked citation', citationId: 'citation-1', reason: 'Sample citation 06D has no linked follow-up in this preview. This does not establish whether action was taken elsewhere.' },
    ],
  },
  'sample-downtown': { locationId: 'sample-downtown', inspections: [], internalChecks: [], followUps: [], flags: [] },
  'sample-queens': { locationId: 'sample-queens', inspections: [], internalChecks: [], followUps: [], flags: [] },
};
