import { accessSettings, accessVerdict } from './access.js';

export class ApiError extends Error {
  constructor(status, code, message, fields) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

// Responses are never cached: follow-ups and city refreshes change what the same URL returns.
export function json(body, status = 200, headers = {}) {
  return Response.json(body, { status, headers: { 'cache-control': 'no-store', ...headers } });
}

// With FSF_ACCESS_CODE set, a change needs the shared access code (and a read does too when FSF_PROTECT_READS is on).
function requireAccess(request) {
  const verdict = accessVerdict(request);
  if (verdict === 'misconfigured') throw new ApiError(503, 'access_misconfigured', 'The access code is set but too short, so changes are blocked until it is fixed.');
  if (verdict === 'locked') throw new ApiError(429, 'too_many_attempts', 'Too many wrong access codes. Wait a minute and try again.');
  if (verdict === 'required') throw new ApiError(401, 'access_code_required', 'Enter the manager access code to continue.');
}

// Wraps a route handler so expected problems become structured errors and unexpected ones never leak details.
// A route with its own gate (the import key, the sign-in itself, the health check) passes { access: 'open' }.
export function handle(handler, { access = 'protected' } = {}) {
  return async (request, context) => {
    try {
      const writing = !['GET', 'HEAD', 'OPTIONS'].includes(request.method);
      if (writing) {
        const origin = request.headers.get('origin');
        const target = new URL(request.url);
        // Next can reconstruct the URL with its listen hostname rather than the
        // browser's actual target (for example localhost versus 127.0.0.1).
        if (request.headers.has('host')) target.host = request.headers.get('host');
        if ((origin !== null && origin !== target.origin) || request.headers.get('sec-fetch-site') === 'cross-site') {
          throw new ApiError(403, 'cross_origin_write', 'Write requests must come from this application.');
        }
      }
      if (access !== 'open' && (writing || accessSettings().protectReads)) requireAccess(request);
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
  const mediaType = String(request.headers.get('content-type') || '').split(';', 1)[0].trim().toLowerCase();
  if (mediaType !== 'application/json') {
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
