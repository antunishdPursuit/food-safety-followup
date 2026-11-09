# Food Safety Follow-Up

A manager-facing prototype for reviewing public NYC restaurant inspections alongside clearly labeled fictional internal checks and manager-entered follow-ups. The product requirements are in [PRD.md](PRD.md).

## Run the interface preview

Use Node.js 20.10 or newer. Run `npm install`, then `npm run dev`, and open `http://localhost:3000`. Run `npm test` and `npm run build` for the current checks.

The interface currently uses labeled sample locations, public-data fixtures, and fictional internal checks. Follow-up edits are held only in the browser session and reset on refresh. The live NYC import, verified CAMIS matching, and persistent follow-up API now exist as the [backend API](#backend-api) below, but the screens are not connected to it yet. The preview does not report current inspection results or confirm corrective action.

The frontend imports its location and detail responses from [`data/preview.json`](data/preview.json) through `lib/fixtures.js`. This bundled file has the same `locationsResponse` and `detailResponses` shape used by the screens. It contains fictional records today. When the verified city export arrives, check each location and CAMIS match, preserve the response shape, and replace the file and sample-specific UI labels together. A bundled file is a snapshot; it does not refresh itself or save follow-up changes.

The frontend includes separate location list/map, location detail, record comparison, follow-up create/edit, and completion-dialog screens. The list and map use the same location IDs. Sample inspections include both a no-violation result and a missing-data state so they are not confused. The ERD and connecting the screens to the API are separate team work.

The selected job description is [sweetgreen Senior Food Safety Manager](https://careers.sweetgreen.com/jobs/8191701?gh_jid=8191701). This independent course project is not affiliated with sweetgreen and has no access to its internal systems or records.

The [concept images](Production/Product%20Concepts) illustrate possible screens. Their locations, findings, counts, and dates are sample values, not verified inspection results.

## Backend API

The backend is a set of Next.js Route Handlers in `app/api` over a small server library in `lib/server`. It builds the NYC Sweetgreen list from the public locations page, verifies each location's NYC Open Data CAMIS permit by address, imports public inspection records, applies the flag rules, and saves manager follow-ups. The screens do not call it yet; the response shapes extend the ones in `data/preview.json`, so connecting them is a swap, not a redesign.

### Set up the live data

Run these in order. Each step is safe to repeat. The city service can be slow (one lookup took 45 seconds) and sometimes returns "service unavailable"; the client waits up to 90 seconds and retries, and a failed run changes nothing.

| Command | What it does |
| --- | --- |
| `npm run data:directory` | Refreshes `data/sweetgreen-nyc-locations.json` from sweetgreen.com/locations (38 NYC locations on 2026-11-09), then reads each location's own page (about 40 requests). Names, addresses, map positions, and phone numbers only. |
| `npm run data:sync` | Loads that directory into the store (`.data/`). Locations start as unverified. |
| `npm run data:match` | Looks each location up in the city dataset by address. **Verified** needs the street address and a Sweetgreen business name to agree. Anything less becomes a **candidate** for the manager to decide, or stays unverified. A Sweetgreen-named permit within 250 m of the location's own map position, or with the same phone number, is also offered as a candidate, with its distance and the address the city lists. A permit in another borough is never offered, and a permit is never offered to two locations. Map coordinates come from the matched city record. |
| `npm run data:status` | Shows coverage, freshness, and each candidate with the reason it was not verified. |
| `npm run data:confirm -- <locationId> <camis>` | The manager picks one candidate permit for a location. A confirmed match is never replaced by a later automatic one. |
| `npm run data:import` | Imports inspection records for verified locations. Re-importing yields the same records and ids. If the city request fails, stored records and follow-ups stay as they were and the error is recorded. |
| `npm run seed:demo` | Adds two fictional checks to up to three verified locations that have city citations: one that names the code of the location's most recent citation (called a temperature or pest check when that citation's description says so, otherwise an audit) and a walkthrough with no citation. Both say they are fictional. |

To try the whole contract without city data, run `npm run dev:sample`. It creates the labeled sample store in `.data-sample/` when it is missing, never in the live store, and starts the app on it. `npm run seed:sample` rebuilds that store. The commands are written in Node, without Unix-only shell syntax, so they work in Windows shells too (a test guards this). `.env.example` lists the settings; none is required.

### Endpoints

All responses are JSON and are never cached. Dates are ISO (`2026-11-09`); times are ISO date-times.

| Request | Returns |
| --- | --- |
| `GET /api/locations` | `{ source, importStatus, locations[] }` for both the map pins and the list rows. Each location has `id`, `name`, `address`, `coordinates` (`[lat, lng]` or `null`), `camis`, `matchStatus` (`verified`, `candidate`, `unverified`), `dataState` (`records`, `no-records`, `not-imported`, `unmatched`), `citationCount` (`null` when there is no inspection record to count), `openFollowUpCount`, `overdueFollowUpCount`, `flagCount`, `candidateCount`, `lastRefreshed`, `sourceUrl`, `isSample`. |
| `GET /api/locations/:id` | `{ locationId, location, importStatus, inspections[], internalChecks[], followUps[], flags[], regionalSignals[] }`. Inspections are newest first, each with `outcome` (`citations`, `no-violations`, `not-yet-inspected`, `unknown`), `source`, `sourceUrl`, grade and score when present, and `citations[]`. Each internal check carries `source: "Fictional demo check"`, a `suggestedCitationId` only when it names an explicit code, and `link` (the manager's decision or `null`). |
| `POST /api/follow-ups` | Creates a follow-up from `{ locationId, citationId?, checkId?, owner, dueDate, notes, status?, completionNote? }`. Needs a citation, a demo check, or both. Returns the saved record with `201`. |
| `PATCH /api/follow-ups/:id` | Updates `owner`, `dueDate`, `notes`, `status` (`Open`, `In progress`, `Complete`), or `completionNote`. `Complete` requires a completion note. The linked finding cannot change. Returns the saved record. |
| `PUT /api/internal-checks/:id/link` | The manager sends `{ decision: "linked" \| "dismissed", citationId? }`. Linking uses the suggested citation unless one is given. Returns the saved check. |
| `POST /api/import` | Refreshes city records. Off unless `FSF_IMPORT_KEY` is set; send it as the `x-import-key` header. |

`importStatus.state` is `ok`, `stale` (older than 72 hours), `failed` (the last attempt failed; `lastSuccess` and the stored records are still shown), `never-run`, or `not-connected` (sample store). Errors look like `{ "error": { "code", "message", "fields"? } }` with status 400 (bad JSON), 404 (unknown id), 413, 415 (not `application/json`), or 422 (field problems, one message per field). Imported city fields are read-only: no endpoint can change an inspection or citation.

Flags use the PRD's two types plus a separate regional list. `Needs review` is a citation with no linked follow-up (a completed follow-up still counts as linked). `Repeat code` is the same code on different inspection dates at one location and stays after an earlier follow-up closes. `regionalSignals` lists codes that appear at two or more covered locations and are never merged into a location's flags.

### Assumptions

Each gap in the PRD gets a logged assumption, with how to check it. Safe means small and easy to undo; risky means it touches what the manager reads or real data.

1. **Directory source.** Gap: the PRD names the locations page but not how to read it. Assumption: parse the structured JSON-LD list on the page and keep a dated snapshot. Why: it publishes names and addresses in a stable form, and a snapshot avoids reading the site on every request. Check: `npm run data:directory`; parsing fails loudly if the page changes. Safe.
2. **What is New York City.** Gap: the page lists suburbs too. Assumption: the five boroughs by ZIP range, so Chappaqua, Scarsdale, Garden City, Manhasset, Huntington, and Woodbury are left out. Why: the city dataset covers only the city. Check: compare `data/sweetgreen-nyc-locations.json` with the page. Safe.
3. **CAMIS verification.** Gap: the PRD says address, not name alone, but not how strict. Assumption: street, building number, ZIP code, and a Sweetgreen name must all agree to verify; any single mismatch is a candidate. Why: a wrong match would put another restaurant's violations under this location. Check: `npm run data:status` lists every candidate and the reason. Risky. Checked against real city data on 2026-11-09: 29 of 38 verified automatically, and every one sits within 116 m of the location's own map position on sweetgreen.com (median 32 m). Bowery and Penn Plaza were then confirmed by the manager (30 m away, and an exact phone match). The other seven are offered one candidate each (6 to 227 m away, see assumption 13). Spring + Hudson is the weakest at 227 m, but the city's geocoder places 315 Hudson Street and the permit's 293 Spring Street in the same building (number 1010362). The Brooklyn permit at 1153 Broadway is not offered for NoMad because the borough differs.
4. **Who confirms a candidate.** Gap: the PRD says the manager confirms uncertain matches during setup, with no screen for it. Assumption: a command-line step, `data:confirm`. Check: ask whether the manager needs a screen. Safe.
5. **Map coordinates.** Gap: the directory has none. Assumption: use only the matched city record's coordinates, and only when they fall inside New York City. Check: locations without coordinates still appear in the list. Safe.
6. **Where records are kept.** Gap: the PRD asks for a persistent store without naming one. Assumption: one JSON file in `.data/`, written under a lock so a request and an import cannot overwrite each other. Why: nothing to install, works on Node 20.10, one manager. Check: replace `lib/server/store.js` with SQLite or Postgres before more than one person uses it; a file does not persist on serverless hosting. Risky for deployment, safe locally.
7. **No sign-in.** Gap: the PRD allows only the manager and excludes accounts. Assumption: the API is open, so run it locally or on a private network. Check: add authentication before any public deployment. Risky if deployed.
8. **Reopening a completed follow-up.** Gap: the PRD requires a manager action and note to complete, and is silent on undoing it. Assumption: allowed; the completion note and time clear and the history keeps every change. Safe.
9. **Stale data.** Gap: no freshness limit is given. Assumption: 72 hours (`FSF_STALE_AFTER_HOURS`). Safe.
10. **Regional signals.** Gap: no time window is given. Assumption: all history, any two covered locations. Check: with real data this may be noisy; consider a date window. Safe.
11. **Newest first.** Gap: the sample data lists inspections oldest first. Assumption: the API returns newest first, which suits real history. Check: the screens must not assume the sample order. Safe.
12. **Demo checks on real locations.** Gap: the PRD wants fictional checks for the same locations. Assumption: add only notes that say they are fictional and claim nothing about the restaurant. Check: every card and export shows the `Fictional demo check` source. Safe.
13. **Map position and phone as evidence.** Gap: the PRD says to verify by address, but the city sometimes lists a corner or alternate address for the same storefront (66 East 55th Street for "60 E 55th St"). Assumption: each location page publishes its own map position and phone number, so a Sweetgreen-named permit within 250 m of that position, or with the same phone number, is offered as a candidate. It is never verified automatically. Why: on 2026-11-09 all 29 automatic matches were within 116 m of the page's position (median 32 m). Check: `npm run data:status` shows each distance. Two permits can share one corporate phone number, so a phone match is evidence, not proof. Safe as a candidate; risky if it verified on its own.

### Checks

`npm test` covers the store, directory parsing, address matching, the NYC client and import, the flag rules, and every endpoint. The tests use fake city responses, and a guard makes any request to the NYC Open Data service or sweetgreen.com fail, so a test run gives the same answer with or without a network. `npm run build` checks the route handlers.

A GitHub Actions workflow (`.github/workflows/ci.yml`) runs `npm ci`, `npm test`, and `npm run build` on Node 20.10 and the current long-term-support release for every pull request and every push to `main`, plus an `npm audit` that only reports. It is not a required check, so nothing in it blocks a merge. By choice it never runs the live city lookups (the `data:*` and `seed:*` commands stay manual), and it has no linting, browser tests, or deployment. Add those after the showcase if the team wants them.
