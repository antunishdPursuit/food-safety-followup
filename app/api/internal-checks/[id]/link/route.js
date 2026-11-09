import { handle, json, readJson } from '../../../../../lib/server/http.js';
import { setCheckLink } from '../../../../../lib/server/mutations.js';

export const dynamic = 'force-dynamic';

// The manager links a demo check to a citation, or dismisses a suggested relationship. Returns the saved check.
export const PUT = handle(async (request, { params }) => json(await setCheckLink((await params).id, await readJson(request))));
