import test from 'node:test';
import assert from 'node:assert/strict';

// The config reads NODE_ENV when it loads, so each case imports a fresh copy through a different query string.
async function headersFor(nodeEnv) {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = nodeEnv;
  try {
    const config = (await import(`../next.config.mjs?env=${nodeEnv}`)).default;
    const [rule] = await config.headers();
    return { config, rule, byKey: Object.fromEntries(rule.headers.map((header) => [header.key, header.value])) };
  } finally {
    process.env.NODE_ENV = previous;
  }
}

test('every route carries the security headers', async () => {
  const { rule, byKey } = await headersFor('production');
  assert.equal(rule.source, '/:path*');
  assert.equal(byKey['X-Content-Type-Options'], 'nosniff');
  assert.equal(byKey['X-Frame-Options'], 'DENY');
  assert.equal(byKey['Referrer-Policy'], 'strict-origin-when-cross-origin');
  assert.match(byKey['Permissions-Policy'], /camera=\(\)/);
});

test('the production policy blocks framing, plugins, eval, and every outside host except map tiles', async () => {
  const { config, byKey } = await headersFor('production');
  const policy = byKey['Content-Security-Policy'];
  assert.match(policy, /frame-ancestors 'none'/);
  assert.match(policy, /object-src 'none'/);
  assert.match(policy, /default-src 'self'/);
  assert.doesNotMatch(policy, /unsafe-eval/);
  assert.doesNotMatch(policy, /ws:/);
  assert.match(policy, /img-src [^;]*https:\/\/\*\.tile\.openstreetmap\.org/);
  const hosts = [...policy.matchAll(/https?:\/\/[^\s;]+/g)].map((match) => match[0]);
  assert.deepEqual(hosts, ['https://*.tile.openstreetmap.org']);
  assert.equal(config.poweredByHeader, false);
});

test('development adds only what hot reloading needs', async () => {
  const { byKey } = await headersFor('development');
  const policy = byKey['Content-Security-Policy'];
  assert.match(policy, /unsafe-eval/);
  assert.match(policy, /connect-src 'self' ws: wss:/);
});
