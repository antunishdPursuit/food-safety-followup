import { handle, json } from '../../../lib/server/http.js';
import { listLocations } from '../../../lib/server/service.js';

export const dynamic = 'force-dynamic';

// Map pins and list rows come from this one response.
export const GET = handle(async () => json(await listLocations()));
