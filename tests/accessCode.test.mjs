import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createSession, validSession } from '../lib/server/access.js';
import { seedSample } from '../lib/server/sample.js';

const CODE = 'correct horse battery';
let counter = 0;

async function app({ code = CODE, protectReads = false } = {}) {
  process.env.FSF_DATA_DIR = await fs.mkdtemp(path.join(os.tmpdir(), 'fsf-access-'));
  await seedSample({ dir: process.env.FSF_DATA_DIR });
  if (code === null) delete process.env.FSF_ACCESS_CODE; else process.env.FSF_ACCESS_CODE = code;
  if (protectReads) process.env.FSF_PROTECT_READS = '1'; else delete process.env.FSF_PROTECT_READS;
  const followUps = await import('../app/api/follow-ups/route.js');
  const locations = await import('../app/api/locations/route.js');
  const session = await import('../app/api/session/route.js');
  const health = await import('../app/api/health/route.js');
  const importer = await import('../app/api/import/route.js');
  // Each test gets its own client address, so the wrong-code counter never leaks between tests.
  counter += 1;
  const from = `10.9.0.${counter}`;
  const send = (handler, method, url, { headers = {}, body } = {}) => handler(new Request(`http://app.test${url}`, {
    method,
    headers: { 'x-forwarded-for': from, ...(body ? { 'content-type': 'application/json' } : {}), ...headers },
    ...(body ? { body: JSON.stringify(body) } : {}),
  }));
  const read = async (response) => ({ status: response.status, body: await response.json(), headers: response.headers });
  return {
    write: async (headers) => read(await send(followUps.POST, 'POST', '/api/follow-ups', { headers, body: {} })),
    list: async (headers) => read(await send(locations.GET, 'GET', '/api/locations', { headers })),
    signIn: async (value, headers) => read(await send(session.POST, 'POST', '/api/session', { headers, body: { code: value } })),
    signOut: async () => read(await send(session.DELETE, 'DELETE', '/api/session')),
    session: async (headers) => read(await send(session.GET, 'GET', '/api/session', { headers })),
    health: async () => read(await send(health.GET, 'GET', '/api/health')),
    importNow: async () => read(await send(importer.POST, 'POST', '/api/import')),
  };
}

test.afterEach(() => {
  delete process.env.FSF_ACCESS_CODE;
  delete process.env.FSF_PROTECT_READS;
});

test('with no access code set, changes are open as before', async () => {
  const { write, session } = await app({ code: null });
  const result = await write();
  assert.notEqual(result.status, 401);
  assert.notEqual(result.status, 503);
  assert.deepEqual((await session()).body, { protected: false, protectReads: false, signedIn: false });
});

test('a change without the code is refused with 401, and reading stays open', async () => {
  const { write, list } = await app();
  const refused = await write();
  assert.equal(refused.status, 401);
  assert.equal(refused.body.error.code, 'access_code_required');
  assert.equal((await list()).status, 200);
});

test('the right code in the x-access-code header or as a bearer token lets a change reach validation', async () => {
  const { write } = await app();
  assert.notEqual((await write({ 'x-access-code': CODE })).status, 401);
  assert.notEqual((await write({ authorization: `Bearer ${CODE}` })).status, 401);
});

test('five wrong codes lock that address out, even for the right code, and the code is never echoed', async () => {
  const { write } = await app();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const refused = await write({ 'x-access-code': `wrong code ${attempt}` });
    assert.equal(refused.status, 401);
    assert.doesNotMatch(JSON.stringify(refused.body), /correct horse/);
  }
  const locked = await write({ 'x-access-code': CODE });
  assert.equal(locked.status, 429);
  assert.equal(locked.body.error.code, 'too_many_attempts');
});

test('signing in sets an HttpOnly, SameSite=Strict cookie that unlocks changes and never contains the code', async () => {
  const { write, signIn, session } = await app();
  const result = await signIn(CODE);
  assert.equal(result.status, 200);
  const cookie = result.headers.get('set-cookie');
  assert.match(cookie, /^fsf_access=/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);
  assert.match(cookie, /Max-Age=604800/);
  assert.doesNotMatch(cookie, /Secure/);
  assert.doesNotMatch(cookie, /correct|horse|battery/);
  const pair = cookie.split(';', 1)[0];
  assert.notEqual((await write({ cookie: pair })).status, 401);
  assert.equal((await session({ cookie: pair })).body.signedIn, true);
  assert.equal((await session()).body.signedIn, false);
});

test('a wrong code at sign-in sets no cookie, and behind https the cookie is Secure', async () => {
  const { signIn } = await app();
  const wrong = await signIn('not the code');
  assert.equal(wrong.status, 401);
  assert.equal(wrong.headers.get('set-cookie'), null);
  const secure = await signIn(CODE, { 'x-forwarded-proto': 'https' });
  assert.match(secure.headers.get('set-cookie'), /; Secure/);
});

test('signing out expires the cookie', async () => {
  const { signOut } = await app();
  assert.match((await signOut()).headers.get('set-cookie'), /Max-Age=0/);
});

test('a tampered, expired, or other-code session is rejected', () => {
  const now = Date.now();
  const { value } = createSession(CODE, now);
  assert.equal(validSession(value, CODE, now + 1000), true);
  assert.equal(validSession(value, 'a different access code', now + 1000), false);
  assert.equal(validSession(value, CODE, now + 8 * 86_400_000), false);
  const [expires, mac] = value.split('.');
  assert.equal(validSession(`${Number(expires) + 86_400_000}.${mac}`, CODE, now + 1000), false);
  const flipped = `${mac.slice(0, -1)}${mac.at(-1) === '0' ? '1' : '0'}`; // always a different last character
  assert.equal(validSession(`${expires}.${flipped}`, CODE, now + 1000), false);
  assert.equal(validSession('', CODE, now), false);
  assert.equal(validSession('a.b.c', CODE, now), false);
});

test('a code shorter than 12 characters blocks every change and every sign-in', async () => {
  const { write, signIn } = await app({ code: 'short' });
  const refused = await write({ 'x-access-code': 'short' });
  assert.equal(refused.status, 503);
  assert.equal(refused.body.error.code, 'access_misconfigured');
  assert.equal((await signIn('short')).status, 503);
});

test('with FSF_PROTECT_READS on, reading needs the code too, but health, sign-in, and import keep their own gates', async () => {
  const { list, health, session, importNow } = await app({ protectReads: true });
  assert.equal((await list()).status, 401);
  assert.equal((await list({ 'x-access-code': CODE })).status, 200);
  assert.equal((await health()).status, 200);
  const state = (await session()).body;
  assert.deepEqual(state, { protected: true, protectReads: true, signedIn: false });
  const imported = await importNow();
  assert.equal(imported.status, 403);
  assert.equal(imported.body.error.code, 'import_disabled');
});
