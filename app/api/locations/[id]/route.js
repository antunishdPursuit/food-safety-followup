import { handle, json } from '../../../../lib/server/http.js';
import { getLocationDetail } from '../../../../lib/server/service.js';

export const dynamic = 'force-dynamic';

export const GET = handle(async (request, { params }) => json(await getLocationDetail((await params).id)));
