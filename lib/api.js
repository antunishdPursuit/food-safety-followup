export class ApiRequestError extends Error {
  constructor(message, status, fields = {}) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

// A read-only snapshot (npm run build:snapshot) is plain files with no server to save to, so reads come from
// /snapshot/*.json and every save says so. NEXT_PUBLIC_SNAPSHOT is set only for that build.
const readOnly = () => Promise.reject(new ApiRequestError('This is a read-only snapshot, so nothing was saved. The full app saves follow-ups.', 405));

export function createApiClient(fetchImpl = (...args) => fetch(...args)) {
  async function request(url, { method = 'GET', body, signal } = {}) {
    const response = await fetchImpl(url, {
      method, signal, cache: 'no-store',
      headers: { accept: 'application/json', ...(body ? { 'content-type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) throw new ApiRequestError(result?.error?.message || 'The request could not be completed. Please try again.', response.status, result?.error?.fields);
    if (!result) throw new ApiRequestError('The server returned an unreadable response. Please try again.', 502);
    return result;
  }
  if (process.env.NEXT_PUBLIC_SNAPSHOT === '1') {
    const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
    return {
      locations: (signal) => request(`${base}/snapshot/locations.json`, { signal }),
      location: (id, signal) => request(`${base}/snapshot/locations/${encodeURIComponent(id)}.json`, { signal }),
      saveFollowUp: readOnly, setCheckLink: readOnly, signIn: readOnly, signOut: readOnly,
      session: async () => ({ protected: false, protectReads: false, signedIn: false }),
    };
  }
  return {
    locations: (signal) => request('/api/locations', { signal }),
    location: (id, signal) => request(`/api/locations/${encodeURIComponent(id)}?regionalMonths=12`, { signal }),
    saveFollowUp: (input, id) => {
      const { owner, dueDate, notes, status, completionNote } = input;
      return request(id ? `/api/follow-ups/${encodeURIComponent(id)}` : '/api/follow-ups', {
        method: id ? 'PATCH' : 'POST',
        body: id ? { owner, dueDate, notes, status, completionNote } : input,
      });
    },
    setCheckLink: (id, decision, citationId) => request(`/api/internal-checks/${encodeURIComponent(id)}/link`, { method: 'PUT', body: { decision, citationId } }),
    session: (signal) => request('/api/session', { signal }),
    signIn: (code) => request('/api/session', { method: 'POST', body: { code } }),
    signOut: () => request('/api/session', { method: 'DELETE' }),
  };
}
