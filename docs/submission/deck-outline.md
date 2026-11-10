# Deck outline: Food Safety Follow-Up (2 minutes 30 seconds)

A six-slide, two-and-a-half-minute presentation covering the job description, proposed workflow and value hypothesis. Show the architecture diagram and pair it with the demo script in `docs/demo-script.md`. Allow about 25 seconds per slide.

**Readiness:** The architecture slide describes the intended API-connected flow. The published screens still use sample fixtures; present it as proposed architecture until frontend integration is merged and the browser walkthrough passes.

| # | Slide | On the slide | Say (about 25 seconds) |
| --- | --- | --- | --- |
| 1 | The role | Title: "Food Safety Follow-Up". One line: sweetgreen, Senior Food Safety Manager, New York. Link to the posting. Footer: independent course project, not affiliated with sweetgreen | "I built this for one real job: the Senior Food Safety Manager for sweetgreen's New York region. The posting is public, and this is an independent course project with no access to sweetgreen's systems." |
| 2 | What the job really is | Two columns: **What the JD says** (reviews audits and sanitation findings, drives corrective action to completion, documents it, reports risk) and **What that implies** (chasing findings across many restaurants, remembering which ones repeat, keeping documentation of reported actions). Signal words underlined: review, track, document, follow up | "The posting names the duties. Between the lines, the job is tracking many findings across many restaurants, noticing when the same one comes back, and documenting reported corrective work." |
| 3 | What it addresses | One sentence in large type: "Connect a city inspection finding to a documented corrective action." Three small labels beneath: public findings, labeled demo checks, manager decisions | "I took one slice of that job: connecting a city inspection finding to a corrective action that a person records. One user, the manager. No accounts, no notifications, no automatic closing." |
| 4 | How it works | Label: **Intended architecture**. `docs/architecture.png`, full width. Nothing else | "This diagram shows the intended flow. The backend connects public pages and city inspection records so that every restaurant has its official record. Written rules mark what needs attention. The manager is the only one who confirms a connection, links evidence, and closes a corrective action. The dashed boxes are the decisions a person makes." |
| 5 | How it improves the workflow | Left: **Before, hypothesized** (findings in the city portal, separate notes, repeats checked manually). Right: **After** (one view with every record labeled by source, a list of findings with no linked follow-up in this prototype and of violations that return, corrective actions with owner, due date, status, and a completion note). Beneath: "Hypothesis: not yet measured." Real result: 38 restaurants, 271 violations, 45 cases of a violation returning, at 25 restaurants | "With real city records, all 38 New York restaurants are connected to their official records, with 271 violations and 45 cases of the same violation coming back. I expect this to help, but I have not measured it, because I have no starting point from a real manager yet." |
| 6 | Business case and next step | Three bullets from the business case: risk (17 repeat flags involve a critical citation, at 14 locations), the audit trail, modest time savings. Next: validate with a real manager, add durable storage and sign-in | "The time saved is modest at this size. The value is catching serious violations that come back and keeping written documentation. Next I would test with a real manager, measure how the work goes today, and add a safer place to keep records and a login." |

## Notes

- **Timing:** 6 slides at 25 seconds is 2 minutes 30. Practice with a timer. If you run long, cut the signal-word underlining on slide 2 first.
- **Slide 4** is the diagram, shown full width. Use the 3200 by 1800 PNG. The text is small, so say the three points aloud instead of reading it.
- **Numbers on slides 5 and 6** are as of 2026-11-09 17:50 UTC. Refresh them with `npm run data:status` only if you also re-record the video, so the two agree.
- **Quote the posting sparingly.** Paraphrase the duties, as above, and link to it.
- **Do not claim** the app uses AI, that it reduces violations, or that any restaurant is unsafe.

- **Plain wording:** the speaker lines lead with the outcome and use the job description's words ("corrective action," "documentation," "violations"). See `plain-language.md` for the one-minute version and the swap table.
