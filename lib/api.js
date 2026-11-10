export class ApiRequestError extends Error {
  constructor(message, status, fields = {}) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

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
  };
}
