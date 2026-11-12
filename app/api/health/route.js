import { staleAfterHours } from '../../../lib/server/config.js';
import { handle, json } from '../../../lib/server/http.js';
import { summarizeStore } from '../../../lib/server/status.js';
import { readDb } from '../../../lib/server/store.js';

export const dynamic = 'force-dynamic';

// A check for an uptime monitor: 200 when the store can be read, 503 when it cannot. It reports counts and times
// only, never records, so it is safe to expose. A stale city import is reported but does not fail the check,
// because stored findings and follow-ups stay usable.
export const GET = handle(async () => {
  const now = new Date();
  let db;
  try {
    db = await readDb();
  } catch {
    return json({ status: 'unavailable', checkedAt: now.toISOString(), store: 'unreadable' }, 503);
  }
  const summary = summarizeStore(db, now);
  const lastSuccess = summary.lastSuccess ? Date.parse(summary.lastSuccess) : null;
  return json({
    status: 'ok',
    checkedAt: now.toISOString(),
    store: 'readable',
    locations: summary.locations,
    verifiedLocations: summary.verified,
    lastSuccessfulImport: summary.lastSuccess,
    lastImportFailed: Boolean(summary.error),
    importStale: lastSuccess === null || now.getTime() - lastSuccess > staleAfterHours() * 3_600_000,
  });
}, { access: 'open' }); // A monitor must reach it without the access code.
