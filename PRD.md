# NYC Food Safety Follow-Up — Product Requirements Document

**Status:** Product requirements reviewed. Implemented and shown at the L2 showcase on 12 November 2026: the screens read and save through the local backend API, all 38 locations are matched to NYC permits, and follow-ups persist in a local file. Pending: a durable database, sign-in, and validation with a working food safety manager.
**Selected JD:** [sweetgreen — Senior Food Safety Manager](https://careers.sweetgreen.com/jobs/8191701?gh_jid=8191701), New York, NY / Remote. The linked role describes NYC Region duties. The posting's current status should be checked at the source.
**Primary user:** The food safety manager responsible for sweetgreen's NYC Region.
**Scope:** Sweetgreen locations in New York City only.

## Problem and job basis

The JD asks the manager to review audits, sanitation violations, complaints, temperature monitoring, and pest activity; guide operators through health-department inspections; report restaurant-level risk; and drive corrective action to completion with timely documentation. Our proposed product focuses on connecting public NYC inspection citations with internal observations and follow-ups.

We have no access to sweetgreen's internal systems and no evidence of its current workflow. The hypothesis is that seeing these sources together will help a manager spot work that needs attention. The prototype tests that hypothesis; it does not claim to reproduce sweetgreen's actual operations.

## Outcome

The manager starts on Home with the product purpose, permit-match coverage and import date, then opens the map and matching list of NYC Sweetgreen locations. A list row or a pin's Open location link reaches the same detail view: public inspection history grouped by year beside saved follow-ups and clearly labeled demo internal checks when available. Supporting-record review retains citations without a linked follow-up and repeated codes. The latest available inspection is dated; older records do not establish unresolved conditions or completed corrections. The same flow works on a phone or tablet during a restaurant visit and on a larger screen for regional review.

The manager is the **only interactive role in version one**. An action owner is a name or role the manager enters; that does not create an employee account or send a message. The manager records status and confirms completion. City data never confirms that a correction occurred.

## Sources and data rules

| Source | Fields used | Label in the app |
| --- | --- | --- |
| [NYC DOHMH Restaurant Inspection Results](https://data.cityofnewyork.us/Health/DOHMH-New-York-City-Restaurant-Inspection-Results/43nn-pn8j) | CAMIS permit ID, address, latitude/longitude when present, inspection date/type, action, violation code/description, critical flag, grade/score when present, record date | Public NYC inspection; show source and last successful refresh |
| [NYC Open Data permit list](https://data.cityofnewyork.us/Health/DOHMH-New-York-City-Restaurant-Inspection-Results/43nn-pn8j) (permits whose name contains SWEETGREEN) | Restaurant name, address, phone, and map position | Location list; city records only, with nothing read from Sweetgreen's website |
| Prototype internal checks | Fictional audit and temperature-check records: location, observed date, issue type, note, optional explicit citation link | Demo internal record on every screen and export |
| Manager-entered follow-ups | Linked citation and/or demo check, owner, due date, notes, status, completion note/time | Prototype follow-up |

The city dataset has one row per citation or special no-violation/not-yet-inspected record; several rows may belong to one inspection. It covers active establishments and limited available history, and may contain missing or inconsistent values. Missing data is never shown as proof of compliance.

The proposed backend work will build the NYC restaurant list from Sweetgreen's public locations page, then verify each restaurant's NYC Open Data CAMIS ID using its address. Business name alone is insufficient. Public inspection coordinates can position matched locations on the map when present. Any location without usable coordinates remains in the list, and any location without a reliable CAMIS match is labeled **inspection match unverified**; neither is silently treated as clear. The product aims to include all currently listed NYC Sweetgreen restaurants and shows coverage count and last refresh time. The frontend receives the verified location records from the backend, rather than making its own city-data request.

The prototype includes a small mix of fictional audit and temperature-check records for the same locations. Include one issue linked by the manager to a citation and one internal concern without a citation. Both are visibly marked fictional. The current frontend uses labeled sample citation fixtures; the target working product will use verified NYC Open Data citations.

## Manager flow

1. **Home, map and list:** Home explains the workflow and shows inspection-match coverage and the last successful city import. The locations workspace shows NYC Sweetgreen pins and matching list rows, public-citation and follow-up counts, and pending-match labels. A row opens its location directly; a pin offers an Open location link to the same record. A separate Map control selects the matching pin. A location without coordinates remains accessible in the list. Stale, failed and partial-import warnings remain visible throughout the app.
2. **Location detail:** See inspections grouped by date/type and their citation rows beside demo internal checks. Every record carries a source label.
3. **Compare:** Open an explained flag and its supporting records. The manager may link a demo check to a citation or dismiss a suggested relationship. The app never silently merges records.
4. **Act:** Create or update a follow-up for a public citation or demo check. Enter owner, due date, notes, and Open or In progress status.
5. **Close:** Mark Complete only with a completion note. Keep the original finding visible. A later inspection citing the same code creates a new citation and repeat flag even if an earlier follow-up was closed.

## Automation and decision rules

| The app does automatically | The manager decides |
| --- | --- |
| Refreshes city records for verified CAMIS IDs, groups citation rows by inspection, avoids duplicate imports | Confirms uncertain location matches during setup |
| Flags a public citation with no linked follow-up | Whether to create an action, its owner, due date, and notes |
| Flags the same violation code at the same CAMIS on a later inspection date; shows cross-location occurrences separately | Whether a repeat suggests an unresolved cause and what to do |
| Shows demo checks beside city records; suggests a match only from an explicit code or reviewed category mapping | Whether a suggested match is valid; may link or dismiss it |
| Shows open/overdue work and prior status history | Whether work is complete and what completion note to record |

**Repeat** means the same city violation code at the same verified location on different inspection dates. A **cross-location pattern** means the same code at two or more covered NYC locations and is a separate regional signal. Similar wording alone is not a match. **Needs review** means no follow-up is linked in this prototype; it is not proof that Sweetgreen took no action elsewhere.

## Scope and readiness

Version one includes NYC public-data import, verified location mapping, labeled demo checks, manager-owned follow-ups, two core flag types, coverage/freshness display, and responsive screens. It excludes real Sweetgreen integration, employee accounts, notifications, regulatory submissions, automatic closure, and other cities. AI-generated explanations or suggested actions would need separate review and are not required for version one.

The PRD has been reviewed. The frontend preview covers the map, location review, record comparison, and follow-up flow using bundled sample data. The remaining backend work verifies location/CAMIS matches against NYC Open Data; integration will connect the screens to the agreed API and persist follow-ups. No Sweetgreen internal data has been verified.

## Requirements and acceptance

| ID | Required behavior | Check |
| --- | --- | --- |
| R1 | Import public records for verified NYC CAMIS IDs, retaining source fields and refresh time | Current source records appear under the matched location; reimport does not duplicate them |
| R2 | Represent multi-citation inspections, no-violation inspections, and missing data distinctly | Each case shows its correct state; an empty response is never called no violation |
| R3 | Keep fictional internal records and manager actions separate from city facts | Every card/export names its source; editing internal data does not alter imported data |
| R4 | Explain unlinked-citation and repeat-code flags with supporting records | Manager can open the records and dismiss a bad suggested match |
| R5 | Persist follow-up owner, due date, notes, and Open/In progress/Complete status | Values survive refresh; completion requires a manager action and note |
| R6 | Support the location-to-follow-up flow on a phone | Manager reads source labels, opens finding, and saves without horizontal scrolling |
| R7 | Show coverage and refresh problems | Unverified locations and stale/failed imports are visible; existing follow-ups remain available |
| R8 | Show a map and list of NYC Sweetgreen locations from one backend response | A pin and its list row open the same location ID; a location without coordinates remains in the list |

For the demo, use a real city citation at a verified covered location when available. If none is in the current dataset, show the honest empty state and use a separately labeled **sample public-data fixture** to demonstrate flag logic. Never present a fixture as a current city record.

## Frontend/backend stitching

This is a **proposed split** for team review; the contract remains useful if ownership changes.

| Proposed visual/frontend work | Proposed data/backend work | Shared contract |
| --- | --- | --- |
| NYC map and location list, location detail, comparison cards, phone follow-up form, loading/empty/error states | NYC location directory and coordinates, import, CAMIS mapping, demo seed data, persistence, comparison rules, follow-up operations | One location ID connects the pin, list row, detail view, inspection data, and follow-ups |
| Render source labels, refresh state, coverage, flag reasons | Return those fields explicitly | Never infer completion or compliance from absent public records |
| Send create/update requests and show the saved response | Validate/persist updates; keep imported city fields read-only | A follow-up can link to a citation, demo check, or both; manager controls status |

**Shared objects:** Location (ID, name, address, coordinates if known, CAMIS if verified, match status, counts); Inspection and Citation (city facts and source link); InternalCheck (fictional observation, demo flag); FollowUp (linked finding IDs, owner, due date, notes, status, completion note/time); Flag (type, supporting IDs, reason, dismissed state); ImportStatus (last success/attempt, error, coverage). IDs remain stable across imports; dates use ISO format.

**Interface contract:** GET /api/locations supplies both map pins and list rows, including coordinates, match status, counts, and refresh state. GET /api/locations/:id supplies its inspections/citations, demo checks, follow-ups, and flags. POST /api/follow-ups creates an action linked to a location and finding; PATCH /api/follow-ups/:id updates it and requires a completion note for Complete. Mutations return the saved record. Invalid IDs return an error; failed city refresh leaves stored records intact. Frontend and backend use fixtures with these response shapes until integration.

**Recommended stack:** Next.js with JavaScript/JSX and CSS for the responsive interface, Leaflet for the client-rendered map, and Next.js Route Handlers for the JSON endpoints and server-side NYC data access. This is still an HTML/CSS/JavaScript product. Use a persistent data store behind the endpoints for follow-ups and demo records; the frontend does not own that state in browser storage. Leaflet's React wrapper does not support server-side rendering, so the interactive map loads only in the browser. The map tile provider must supply the visible attribution required by its terms.

## Visual concepts

These screen concepts describe the intended interactions. The working product must use real NYC public values and persistent demo/manager-entered records.

### NYC location map and list

Home is the entry page; the map workspace opens a location's inspection history before record comparison.

### Manager comparison view

The manager sees the public source, a demo internal record, and an explained follow-up flag.

### Phone follow-up view

The manager opens the source records, enters owner, due date, and notes, then saves. There is no staff sign-in or staff-completion step in version one.
