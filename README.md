# Food Safety Follow-Up

A manager-facing prototype for reviewing public NYC restaurant inspections alongside clearly labeled fictional internal checks and manager-entered follow-ups. The product requirements are in [PRD.md](PRD.md).

## Run the interface preview

Use Node.js 20.9 or newer. Run `npm install`, then `npm run dev`, and open `http://localhost:3000`. Run `npm test` and `npm run build` for the current checks.

The interface currently uses labeled sample locations, public-data fixtures, and fictional internal checks. Follow-up edits are held only in the browser session and reset on refresh. The live NYC import, verified CAMIS matching, and persistent follow-up API are still to be connected. The preview does not report current inspection results or confirm corrective action.

The selected job description is [sweetgreen Senior Food Safety Manager](https://careers.sweetgreen.com/jobs/8191701?gh_jid=8191701). This independent course project is not affiliated with sweetgreen and has no access to its internal systems or records.

The [concept images](Production/Product%20Concepts) illustrate possible screens. Their locations, findings, counts, and dates are sample values, not verified inspection results.
