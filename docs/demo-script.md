# Demo script: Food Safety Follow-Up (2 minutes 30 seconds)

One storyline, on real data: a critical pest finding at one restaurant was cited twice in 15 days. The manager links a fictional internal check to it, records a follow-up, and closes it with a note. The original finding and the repeat flag stay visible.

**Where it runs.** The click path below uses today's screen names. The screens still read sample data until Dennys connects them to the API, and the wording may change when he does. Every number below is real as of 2026-11-09 and was rehearsed on a copy of the live store through the same code the screens will call.

## Before you record

1. Run `npm run data:status` and check it says **38 verified**, **118 inspections**, **271 citations**. Do not run `npm run data:import` after you rehearse: a refresh can change these numbers.
2. Confirm the screens are connected to the API (Dennys). If they are not connected by **Tuesday 12:00**, record the fallback at the end of this page instead.
3. Run `npm run demo:reset -- --yes` to clear rehearsal follow-ups and link decisions. It saves a copy of the store first and refuses to run without `--yes`.
4. Start the app on the live store (`npm run dev`, not `npm run dev:sample`).
5. Window about 1280 by 720, browser zoom 110 to 125 percent, notifications off. Rehearse twice with a timer, resetting between runs.

## The beats

| Time | Screen | You do | You say |
| --- | --- | --- | --- |
| 0:00 to 0:20 | Map and list | Show the 38 locations, the coverage line, and the last refresh date | "A food safety manager for a New York restaurant group has to connect public inspection findings to documented corrective action. This is Food Safety Follow-Up, built for sweetgreen's Senior Food Safety Manager role. All 38 New York restaurants are connected to their official city records." |
| 0:20 to 0:38 | Click **Chambers St** | Scroll to the inspection history and the **Needs attention** cards | "Every record names its source. This is public NYC data: four inspections and 16 citations. The newest is a re-inspection on 29 July 2026, grade A, with three citations. The tool lists 20 items for review." |
| 0:38 to 1:05 | Open the **Repeat code** flag for 04N | Show the two citations side by side | "Code 04N, filth flies, a critical violation, was cited on 14 July and again on 29 July, fifteen days apart. The tool marks the repeat. It does not say why it happened or whether anyone acted. That is for the manager." |
| 1:05 to 1:25 | Same page, **Fictional demo check** | Click **Link records** | "This pest activity check is a fictional demo record, labeled as fictional. It names code 04N, so the tool suggests the link. A written rule suggests it; I decide. The records stay separate until I link them." |
| 1:25 to 1:55 | Click **Create follow-up** | Owner: `Kitchen manager`. Due date: `2026-11-20`. Notes: `Pest control visit; re-check seals and drains; verify before the next inspection.` Status: Open. **Save follow-up** | "I record an owner, a due date, and the action. The owner is just a name. Nothing is sent to anyone. The item for that violation clears, from 20 items to 19, because it now has a corrective action." |
| 1:55 to 2:15 | Open the follow-up, **Mark complete…** | Completion note: `Pest control completed; seals replaced; verified on a walkthrough.` Finish | "City data can never confirm a correction, so completion needs my note. The original finding stays visible, and the repeat marker stays, because a later inspection could cite the same violation again." |
| 2:15 to 2:30 | Back on the location | Pause on the location page | "One user, one workflow: public findings, labeled demo checks, and my decisions, in one place. A working model, with no access to sweetgreen's internal systems." |

The narration is about 250 words, roughly 100 seconds at a relaxed 150 words a minute, which leaves about 50 seconds for clicking and typing. Speak while you type. If you run long, shorten the 0:38 beat first.

## Real numbers to have in mind (2026-11-09)

- 38 of 38 locations verified (29 matched automatically, 9 confirmed by the manager), 37 with a map pin. Penn Plaza has no pin because the city record has no coordinates, so it appears in the list only.
- 118 inspections and 271 citations across all 38 locations, from 2022-10-18 to 2026-10-23. Of the citations, 112 are critical (41 percent).
- Chambers St: 125 Chambers St, permit 50091763, 4 inspections, 16 citations, 20 flags (16 needs review, 4 repeat). The repeat codes are 04N and 08A (14 and 29 July 2026), 02B (2024 and 2026), and 10F (2024 and 2025).
- Code 04N appears at 13 locations. Code 10F appears at 35 of the 38.
- Across all locations: 316 flags, of which 45 are repeat flags at 25 locations.

## Say, and do not say

- Say "public records", "flag", "needs review", "the manager decides", "prototype".
- Do not say a restaurant is unsafe, non-compliant, or "failed". A citation is a recorded finding, not a conclusion.
- Do not say "needs review" means nobody acted. It means no follow-up is linked in this prototype.
- Do not say the app uses AI. It applies written rules.
- Do not claim it improves anything yet. The hypothesis is untested and no baseline has been measured.

## If something goes wrong

- **The app will not start or the screens are not connected.** Use the fallback below, or stop and tell Dennys.
- **Numbers differ from this page.** Run `npm run data:status`. If the date is later than 2026-11-09 17:50 UTC, someone refreshed the data. Quote what the status shows.
- **A screen label differs from this script.** Follow the same beat with the new label. The storyline does not depend on a button name.

## Fallback: the same story through the API

Use this only if the screens are not connected. Start the app with `npm run dev`, then run each request in a terminal, showing the response each time.

```bash
curl -s localhost:3000/api/locations/chambers-st
```

```bash
curl -s -X PUT localhost:3000/api/internal-checks/demo-chambers-st-coded/link -H 'content-type: application/json' -d '{"decision":"linked"}'
```

```bash
curl -s -X POST localhost:3000/api/follow-ups -H 'content-type: application/json' -d '{"locationId":"chambers-st","citationId":"i-50091763-20260729-cycle-inspection-re-inspection--04N","checkId":"demo-chambers-st-coded","owner":"Kitchen manager","dueDate":"2026-11-20","notes":"Pest control visit; re-check seals and drains; verify before the next inspection."}'
```

Then complete it with the id the previous response returned:

```bash
curl -s -X PATCH localhost:3000/api/follow-ups/FOLLOW-UP-ID -H 'content-type: application/json' -d '{"status":"Complete","completionNote":"Pest control completed; seals replaced; verified on a walkthrough."}'
```

## Questions for Thursday

- **Is this real data?** The inspections are real NYC Open Data records. The internal checks are fictional and labeled. There is no sweetgreen internal data.
- **How do you know a location matches its permit?** Street address and business name must both agree. Anything weaker is a candidate, and a person confirms it. Each automatic match sits within 116 meters of the location's own published map position.
- **What if the city service is down?** It was, for stretches on 2026-11-09. A failed refresh keeps the stored records, and follow-ups stay available.
- **Why not close findings automatically?** City data cannot show that a correction happened. Only the manager can, with a note.
- **What is next?** Test with a real food safety manager against a measured baseline, then add durable storage and protected sign-in before any public use.
