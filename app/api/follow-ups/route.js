import { handle, json, readJson } from '../../../lib/server/http.js';
import { createFollowUp } from '../../../lib/server/mutations.js';

export const dynamic = 'force-dynamic';

// Creates a follow-up linked to a location and a citation and/or demo check. Returns the saved record.
export const POST = handle(async (request) => json(await createFollowUp(await readJson(request)), 201));
