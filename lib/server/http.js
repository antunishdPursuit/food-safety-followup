export class ApiError extends Error {
  constructor(status, code, message, fields) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

// Responses are never cached: follow-ups and city refreshes change what the same URL returns.
export function json(body, status = 200) {
  return Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
}

// Wraps a route handler so expected problems become structured errors and unexpected ones never leak details.
export function handle(handler) {
  return async (request, context) => {
    try {
      return await handler(request, context);
    } catch (error) {
      if (error instanceof ApiError) {
        return json({ error: { code: error.code, message: error.message, ...(error.fields ? { fields: error.fields } : {}) } }, error.status);
      }
      console.error(error);
      return json({ error: { code: 'internal_error', message: 'Something went wrong. Try again.' } }, 500);
    }
  };
}

// Requires a JSON object body of reasonable size. Demanding application/json also stops a plain cross-site form post.
export async function readJson(request, maxBytes = 100_000) {
  if (!String(request.headers.get('content-type') || '').toLowerCase().includes('application/json')) {
    throw new ApiError(415, 'unsupported_media_type', 'Send the request as application/json.');
  }
  const text = await request.text();
  if (text.length > maxBytes) throw new ApiError(413, 'payload_too_large', 'The request is too large.');
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new ApiError(400, 'invalid_json', 'The request body is not valid JSON.');
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ApiError(400, 'invalid_body', 'The request body must be a JSON object.');
  return body;
}
