import { handle, json } from '../../../../lib/server/http.js';
import { getLocationDetail } from '../../../../lib/server/service.js';

export const dynamic = 'force-dynamic';

// Optional ?regionalMonths=12 limits regional signals to inspections in the last 12 months (1 to 120).
export const GET = handle(async (request, { params }) => {
  const regionalMonths = new URL(request.url).searchParams.get('regionalMonths');
  return json(await getLocationDetail((await params).id, { regionalMonths }));
});
