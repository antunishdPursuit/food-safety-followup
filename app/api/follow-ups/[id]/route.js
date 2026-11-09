import { handle, json, readJson } from '../../../../lib/server/http.js';
import { updateFollowUp } from '../../../../lib/server/mutations.js';

export const dynamic = 'force-dynamic';

// Updates owner, due date, notes, or status. Complete requires a completion note. Returns the saved record.
export const PATCH = handle(async (request, { params }) => json(await updateFollowUp((await params).id, await readJson(request))));
