# Food Safety Follow-Up

Food Safety Follow-Up is a course prototype for a food safety manager overseeing sweetgreen restaurants in New York City. It brings public restaurant-inspection findings and manager-entered follow-ups into one review workflow, helping the manager identify citations that need attention and keep corrective actions connected to their source records.

The workflow starts with a map and matching location list. The manager opens a restaurant's inspection history, reviews citations and repeated violation codes, compares supporting records, and records an action with an owner, due date, and notes. Completing a follow-up requires an explicit manager decision and a completion note; city inspection data alone cannot confirm that a correction occurred.

The project is based on the [sweetgreen Senior Food Safety Manager job description](https://careers.sweetgreen.com/jobs/8191701?gh_jid=8191701), which includes reviewing sanitation violations and driving documented corrective action in the NYC Region. This independent course project is not affiliated with sweetgreen and has no access to its internal systems or records. The scope and requirements are in [PRD.md](PRD.md); the preview's data limits are described below.

## Run the interface preview

Use Node.js 20.10 or newer. Run `npm install`, then `npm run dev`, and open `http://localhost:3000`. Run `npm test` and `npm run build` for the current checks.

The interface currently uses labeled sample locations, public-data fixtures, and fictional internal checks. Follow-up edits are held only in the browser session and reset on refresh. The live NYC import, verified CAMIS matching, and persistent follow-up API are still to be connected. The preview does not report current inspection results or confirm corrective action.

The frontend imports its location and detail responses from [`data/preview.json`](data/preview.json) through `lib/fixtures.js`. This bundled file has the same `locationsResponse` and `detailResponses` shape used by the screens. It contains fictional records today. When the verified city export arrives, check each location and CAMIS match, preserve the response shape, and replace the file and sample-specific UI labels together. A bundled file is a snapshot; it does not refresh itself or save follow-up changes.

The frontend includes separate location list/map, location detail, record comparison, follow-up create/edit, and completion-dialog screens. The list and map use the same location IDs. Sample inspections include both a no-violation result and a missing-data state so they are not confused. The ERD and backend integration are separate team work.

The [concept images](Production/Product%20Concepts) illustrate possible screens. Their locations, findings, counts, and dates are sample values, not verified inspection results.
