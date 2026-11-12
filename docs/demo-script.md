# Demo script: Food Safety Follow-Up (2 minutes 30 seconds)

One storyline, on real data: a critical pest finding at one restaurant was cited twice in 15 days. The manager links a fictional internal check to it, records a follow-up, and closes it with a note. The original finding and the repeat flag stay visible. All manager actions below are hypothetical rehearsal entries in an isolated copy, not records of corrective work at this restaurant.

**Where it runs.** The screens read records and save follow-ups through the API. A browser walkthrough and recording rehearsal are still required. The dated contributor-snapshot figures below were rehearsed by the contributor through the API; use the baseline checks below before recording.

## Choose the data baseline

The fixed numbers and IDs below describe the backend contributor's reviewed 2026-11-09 snapshot, not a data file shipped in Git. To reproduce that exact take, obtain the contributor's clean `db.json` export used for the [final status in backend PR #1](https://github.com/antunishdPursuit/food-safety-followup/pull/1): 38 verified locations, 118 inspections, 271 citations, last successful import `2026-11-09T17:39:11.188Z`. Check those fields with `npm run data:status` on the selected copy before using the fixed narration.

**If that export is unavailable, use your own imported store instead.** Prepare it from the saved permit list and confirmed matches (`npm run data:sync`, `npm run data:seed-matches`, `npm run data:import`), or use the current store you already imported. Leave uncertain permit matches unverified. With the app running on its rehearsal copy, read `GET /api/locations` and `GET /api/locations/<verified-location-id>`; choose an available current flag and its returned citation/check IDs. Replace the example counts, location, codes, dates and request IDs with those actual values in both the narration and deck. If no repeat flag is available, demonstrate a current Needs review citation rather than claiming a repeat. Use the city-record-only variant when no matching fictional check exists. The fixed-count checks below apply only to the contributor snapshot; for a current store, verify and quote its own coverage and counts.

## Before you record

1. For every rehearsal and recording, create a fresh copy of the unchanged pre-rehearsal city-data snapshot in a new directory and select it with `FSF_DATA_DIR`. Use that same selected store for every command below and for the app. Do not reuse a previous take's copy; its saved follow-ups and link decisions remain preserved there.
2. Run `npm run data:status` against that copy. For the contributor snapshot, check for **38 verified**, **118 inspections**, **271 citations**. For a current store, record and use its actual coverage and counts instead, including any unverified locations. In either mode, record `Last successful import` for this rehearsal. Do not run `npm run data:import` afterward: a refresh can change the numbers.
3. Stop the previous rehearsal server, then start the app on the selected city-data store (`npm run dev`, not `npm run dev:sample`).
4. Confirm the screens are connected to the API. If they are not connected, use the API fallback at the end of this page instead.
5. On that same selected store, run `npm run seed:demo` if the fictional checks are missing. It seeds only the three locations with the most citations. For the contributor snapshot, verify whether `demo-chambers-st-coded` exists and its suggested citation matches the example below. For a current store, use the chosen location's returned check and citation IDs. If the check is absent or points elsewhere, use the city-record-only variant below.
6. Window about 1280 by 720, browser zoom 110 to 125 percent, notifications off. Rehearse twice with a timer, repeating steps 1–5 with a fresh copy for each run.

**City-record-only variant:** For the contributor snapshot, keep the Chambers St public-citation story; for a current store, use the verified location and citation you selected. Skip the fictional-check linking beat and create the follow-up from that city citation alone. Say that no company internal checks are connected; do not claim an internal record was linked. Use that beat to show the public source and date. In the API fallback, skip the optional PUT and use the city-record-only POST.

## Example beats for the contributor snapshot

These exact counts, dates and IDs apply to the contributor snapshot. For a current store, substitute the verified values and records selected above before recording.

| Time | Screen | You do | You say |
| --- | --- | --- | --- |
| 0:00 to 0:20 | Home, then locations | Show coverage and last import on Home, click **Open locations**, then show the map/list | "A food safety manager for a New York restaurant group has to connect public inspection findings to documented corrective action. This is Food Safety Follow-Up, built for sweetgreen's Senior Food Safety Manager role. All 38 New York restaurants are connected to their official city records." |
| 0:20 to 0:38 | Click **Sweetgreen, 125 Chambers St** | Show the dated latest inspection, expand its year if needed, then open **Review prompts and repeated codes** | "Every record names its source. This is public NYC data: four inspections and 16 violations. The newest is a re-inspection on 29 July 2026, grade A, with three citations. The tool lists 20 items for review." |
| 0:38 to 1:05 | Open the **Repeat code** flag for 04N | Show the two citations side by side | "Code 04N, filth flies, a critical violation, was cited on 14 July and again on 29 July, fifteen days apart. The tool marks the repeat, meaning the same code on two inspection dates. It does not say why it happened or whether anyone acted. That is for the manager." |
| 1:05 to 1:25 | Same page, **Fictional demo check** | Click **Link records** | "This pest activity check is a fictional demo record, labeled as fictional. It names code 04N, so the tool suggests the link. A written rule suggests it; I decide. The records stay separate until I link them." |
| 1:25 to 1:55 | Click **Create follow-up** | Owner: `Demo manager`. Due date: `2026-11-20`. Notes: `Hypothetical demo action: arrange a pest-control visit and check seals and drains. Not an actual restaurant action.` Status: Open. **Save follow-up** | "I record a hypothetical rehearsal action, an owner and a due date. No notification is sent. The count changes from 20 to 19 because this prototype now has a linked follow-up, not because real work was verified." |
| 1:55 to 2:15 | Open the follow-up, **Mark complete…** | Completion note: `Hypothetical demo completion for rehearsal only. No corrective work at this restaurant was verified.` Finish | "I record a hypothetical completion note for rehearsal, not a claim about work at this restaurant. The source finding and repeat marker stay visible. The app stores my note; it does not independently verify corrective work." |
| 2:15 to 2:30 | Back on the location | Pause on the location page | "One user, one workflow: public findings, labeled demo checks, and my decisions, in one place. A working model, with no access to sweetgreen's internal systems." |

The narration is about 265 words, roughly 105 seconds at a relaxed 150 words a minute, which leaves about 45 seconds for clicking and typing. Speak while you type. If you run long, shorten the 0:38 beat first.

## Contributor snapshot figures (2026-11-09)

- 38 of 38 locations verified (29 matched automatically, 9 confirmed by the manager), all 38 with a map pin. Penn Plaza's pin comes from Sweetgreen's own page, because the city record has no coordinates; the screens can show that source (`coordinatesSource`).
- 118 inspections and 271 citations across all 38 locations, from 2022-10-18 to 2026-10-23. Of the citations, 112 are critical (41 percent).
- Chambers St: 125 Chambers St, permit 50091763, 4 inspections, 16 citations, 20 flags (16 needs review, 4 repeat). The repeat codes are 04N and 08A (14 and 29 July 2026), 02B (2024 and 2026), and 10F (2024 and 2025).
- Code 04N appears at 13 locations. Code 10F appears at 35 of the 38.
- Across all locations: 316 flags, of which 45 are repeat flags at 25 locations.
- Of the 271 citations: 17 use administrative codes that the city does not score (calorie posting 16-03, 16-04, and 16-06; straws 19-07; the healthy-eating poster 20-08); 64 are code 10F, a broad upkeep code; and up to 99 carry codes that a restaurant can cure (10F, 10B, 09C, 08B, 20-08), an upper bound, because the data cannot show which were cured.
- All 118 inspections have at least one violation. That is normal: only 0.3 percent of New York cycle initial inspections in the last 12 months had none, and none of the 41 Sweetgreen-named permits has one. The inspection pace also matches the city's: the median is two cycle initial inspections per restaurant in three years, here and citywide.

## Say, and do not say

- Say "public records", "flag", "needs review", "the manager decides", "prototype".
- Do not say a restaurant is unsafe, non-compliant, or "failed". A citation is a recorded finding, not a conclusion.
- Do not say "needs review" means nobody acted. It means no follow-up is linked in this prototype.
- Do not say the app uses AI. It applies written rules.
- Do not claim it improves anything yet. The hypothesis is untested and no baseline has been measured.
- Say "violations" for what the city recorded, never "points" or "severity". The data has the code and a critical flag, and nothing about how serious each violation was.
- Say "repeat" only with its meaning: the same code on a different inspection date. It is our rule, not the city's.
- Do not call 04N a public health hazard. The city classes it as critical, which is a different class.
- Do not say a cure or a completed follow-up means the problem is gone. Both show only what someone recorded.

## If something goes wrong

- **The app will not start or the screens are not connected.** Use the fallback below, or stop and tell the maintainer.
- **Numbers differ from this page.** Run `npm run data:status`. Compare `Last successful import` with the value recorded for rehearsal; `Status as of` is only the current check time. If coverage or counts differ, quote the verified current values and rehearse again.
- **A screen label differs from this script.** Follow the same beat with the new label. The storyline does not depend on a button name.

## API fallback example for the contributor snapshot

Use this if the screens are not connected. The literal IDs below apply to the contributor snapshot; for a current store, substitute the returned IDs for your selected records. Start the app on the selected rehearsal copy with `npm run dev`, then run each request in a terminal, showing the response each time.

```bash
curl -s localhost:3000/api/locations/chambers-st
```

**Optional:** Run this PUT only when the verified demo check exists and points to the chosen citation; otherwise skip it.

```bash
curl -s -X PUT localhost:3000/api/internal-checks/demo-chambers-st-coded/link -H 'content-type: application/json' -d '{"decision":"linked"}'
```

**Choose exactly one create request.** For the full fictional-check variant, after verifying and linking that check:

```bash
curl -s -X POST localhost:3000/api/follow-ups -H 'content-type: application/json' -d '{"locationId":"chambers-st","citationId":"i-50091763-20260729-cycle-inspection-re-inspection--04N","checkId":"demo-chambers-st-coded","owner":"Demo manager","dueDate":"2026-11-20","notes":"Hypothetical demo action: arrange a pest-control visit and check seals and drains. Not an actual restaurant action."}'
```

For the city-record-only variant, skip the PUT and use this POST instead:

```bash
curl -s -X POST localhost:3000/api/follow-ups -H 'content-type: application/json' -d '{"locationId":"chambers-st","citationId":"i-50091763-20260729-cycle-inspection-re-inspection--04N","owner":"Demo manager","dueDate":"2026-11-20","notes":"Hypothetical demo action: arrange a pest-control visit and check seals and drains. Not an actual restaurant action."}'
```

Then complete it with the id the previous response returned:

```bash
curl -s -X PATCH localhost:3000/api/follow-ups/FOLLOW-UP-ID -H 'content-type: application/json' -d '{"status":"Complete","completionNote":"Hypothetical demo completion for rehearsal only. No corrective work at this restaurant was verified."}'
```

## Questions and answers

- **Is this real data?** The inspections are real NYC Open Data records. The internal checks are fictional and labeled. There is no sweetgreen internal data.
- **How do you know a location matches its permit?** Street address and business name must both agree. Anything weaker is a candidate, and a person confirms it. Each automatic match sits within 116 meters of the location's own published map position.
- **What if the city service is down?** It was, for stretches on 2026-11-09. A failed refresh keeps the stored records, and follow-ups stay available.
- **Why not close findings automatically?** City data cannot show that a correction happened. The manager records completion with a note; the app stores that statement rather than independently verifying the correction.
- **What is next?** Test with a real food safety manager against a measured baseline, then add durable storage and protected sign-in before any public use.
- **What does "repeat" mean?** The same violation code on a different inspection date at one restaurant. It is our rule. The city's own repeat penalties apply only to certain non-food-safety codes, such as plastic straws and tobacco.
- **Can the city data show a violation was fixed?** No. A restaurant can "cure" a first-time violation by sending proof within 7 days, but the violation stays on the public record and no score or grade changes. A manager's note records their account of corrective work.
- **Why is code 10F at almost every restaurant?** Since the rules adopted in 2021 (proposed in 2020), the city files general upkeep problems under 10F, such as dirty or damaged floors, walls, and equipment, and also conditions that invite pests when no pests are seen. It is a broad code, so it says little about any one restaurant.
- **Why are there no clean inspections?** Almost no New York cycle inspection finds zero violations: 0.3 percent in the last 12 months. None of the 41 Sweetgreen-named permits or 98 salad restaurants had one either.
- **How well does the matching work?** Run fresh on all 38, the rule alone verified 29 and every one agreed with the final match. The other 9 were offered with the right permit ranked first, and a person confirmed them. An independent building check agrees for 33 of the 37 locations it could test. Hudson Yards and NoMad, whose page and permit addresses differ, were checked on a map, and both agree.
