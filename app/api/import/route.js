import { createHash, timingSafeEqual } from 'node:crypto';
import { ApiError, handle, json } from '../../../lib/server/http.js';
import { refreshInspections } from '../../../lib/server/importer.js';
import { createNycClient } from '../../../lib/server/nyc.js';

export const dynamic = 'force-dynamic';

const digest = (value) => createHash('sha256').update(String(value)).digest();
let running = false;

// Lets a scheduler refresh city records. Off unless FSF_IMPORT_KEY is set; callers send it as the x-import-key
// header. A failed city request leaves stored records intact and returns 502 with the recorded error.
export const POST = handle(async (request) => {
  const expected = process.env.FSF_IMPORT_KEY;
  if (!expected) throw new ApiError(403, 'import_disabled', 'Refreshing from the web is turned off. Set FSF_IMPORT_KEY, or run npm run data:import.');
  if (!timingSafeEqual(digest(request.headers.get('x-import-key') || ''), digest(expected))) {
    throw new ApiError(401, 'unauthorized', 'The import key is missing or wrong.');
  }
  if (running) throw new ApiError(409, 'import_running', 'A refresh is already running.');
  running = true;
  try {
    const result = await refreshInspections({ client: createNycClient() });
    return json(result, result.ok ? 200 : 502);
  } finally {
    running = false;
  }
});
