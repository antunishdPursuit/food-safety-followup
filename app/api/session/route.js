import { ApiError, handle, json, readJson } from '../../../lib/server/http.js';
import { accessSettings, clearFailures, createSession, hasSession, lockedOut, noteFailure, sameSecret, sessionCookie } from '../../../lib/server/access.js';

export const dynamic = 'force-dynamic';

// The page asks this to decide whether to show "Enter access code". It never reveals the code or its length.
export const GET = handle(async (request) => {
  const settings = accessSettings();
  return json({ protected: settings.enabled, protectReads: settings.protectReads, signedIn: hasSession(request) });
}, { access: 'open' });

// Signs a browser in: a right code sets an HttpOnly, SameSite=Strict cookie that lasts seven days.
export const POST = handle(async (request) => {
  const settings = accessSettings();
  if (!settings.enabled) throw new ApiError(404, 'access_code_off', 'No access code is set for this app.');
  if (settings.tooShort) throw new ApiError(503, 'access_misconfigured', 'The access code is set but too short, so sign-in is blocked until it is fixed.');
  if (lockedOut(request)) throw new ApiError(429, 'too_many_attempts', 'Too many wrong access codes. Wait a minute and try again.');
  const body = await readJson(request, 1_000);
  if (!sameSecret(String(body.code ?? ''), settings.code)) {
    noteFailure(request);
    throw new ApiError(401, 'invalid_access_code', 'That access code is not right.');
  }
  clearFailures(request);
  const session = createSession(settings.code);
  return json({ signedIn: true }, 200, { 'set-cookie': sessionCookie(request, session.value, session.maxAge) });
}, { access: 'open' });

export const DELETE = handle(async (request) => json({ signedIn: false }, 200, { 'set-cookie': sessionCookie(request, '', 0) }), { access: 'open' });
