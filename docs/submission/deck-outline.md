# Deck outline: Food Safety Follow-Up (2 minutes 30 seconds)

LaNice's Final Project Submission needs two parts, due **Wednesday 2026-11-11 at 12:00** through the Google Form: a 2.5-minute working demo video (script in `docs/demo-script.md`) and this 2.5-minute deck, with the architecture diagram shown. The deck covers three things she named: the JD, what the product addresses, and how it improves the workflow. Six slides, about 25 seconds each.

| # | Slide | On the slide | Say (about 25 seconds) |
| --- | --- | --- | --- |
| 1 | The role | Title: "Food Safety Follow-Up". One line: sweetgreen, Senior Food Safety Manager, New York. Link to the posting. Footer: independent course project, not affiliated with sweetgreen | "I built this for one real job: the Senior Food Safety Manager for sweetgreen's New York region. The posting is public, and this is an independent course project with no access to sweetgreen's systems." |
| 2 | What the job really is | Two columns: **What the JD says** (reviews audits and sanitation findings, drives corrective action to completion, documents it, reports risk) and **What that implies** (chasing findings across many restaurants, remembering which ones repeat, keeping proof that someone acted). Signal words underlined: review, track, document, follow up | "The posting names the duties. Between the lines, the job is tracking many findings across many restaurants, noticing when the same one comes back, and proving that action was taken." |
| 3 | What it addresses | One sentence in large type: "Connect a public inspection finding to a documented follow-up." Three small labels beneath: public findings, labeled demo checks, manager decisions | "I took one slice of that job: connecting a public inspection finding to a follow-up that a person records. One user, the manager. No accounts, no notifications, no automatic closing." |
| 4 | How it works | `docs/architecture.png`, full width. Nothing else | "Public pages and city data flow through matching and import into one store. Rules raise flags. The manager is the only one who confirms a match, links evidence, and closes a follow-up. The dashed boxes are the people decisions." |
| 5 | How it improves the workflow | Left: **Before** (findings in the city portal, notes somewhere else, repeats found by memory). Right: **After** (one view with every record labeled by source, flags for unlinked findings and repeats, follow-ups with owner, due date, status, and a completion note). Beneath: "Hypothesis: not yet measured." Real result: 38 locations, 271 citations, 45 repeat flags at 25 locations | "On real city data, all 38 New York locations are matched, with 271 citations and 45 repeat flags. The improvement is a hypothesis. I have no baseline from a real manager yet, so I am not claiming a number." |
| 6 | Business case and next step | Three bullets from the business case: risk (17 repeat flags involve a critical citation, at 14 locations), the audit trail, modest time savings. Next: validate with a real manager, add durable storage and sign-in | "The time saved is modest at this size. The value is catching repeat critical findings and keeping an audit trail. Next I would test with a real manager against a measured baseline, then add durable storage and protected sign-in." |

## Notes

- **Timing:** 6 slides at 25 seconds is 2 minutes 30. Practice with a timer. If you run long, cut the signal-word underlining on slide 2 first.
- **Slide 4** is the diagram, shown full width. Use the 3200 by 1800 PNG. The text is small, so say the three points aloud instead of reading it.
- **Numbers on slides 5 and 6** are as of 2026-11-09 17:50 UTC. Refresh them with `npm run data:status` only if you also re-record the video, so the two agree.
- **Quote the posting sparingly.** Paraphrase the duties, as above, and link to it.
- **Do not claim** the app uses AI, that it reduces violations, or that any restaurant is unsafe.
