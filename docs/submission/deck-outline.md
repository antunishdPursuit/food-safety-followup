# Deck outline: Food Safety Follow-Up (about 4 minutes, with the film)

A nine-slide presentation for the L2 showcase of 12 November 2026, given by Dennys Antunish and Valerie Zandoli: the job description, why we chose it, the proposed workflow, a showcase film, and the value hypothesis. The deck is a Google Slides file named "Food Safety Follow-Up". The film plays from YouTube (https://youtu.be/6t9ewV_8y48), with the player at the top of the README as the backup. The speaking version is the showcase script (version 3 runs about 4 minutes 7 seconds counting the film; that figure is an estimate from word counts, not a timed rehearsal). Pair the deck with the demo script in `docs/demo-script.md`.

**Readiness:** The screens are connected to the backend API, and all 38 locations are matched to city permits. The film was recorded from the live app. The numbers on slides 8 and 9 are as of 9 November 2026 and were recomputed against live city data on 11 November 2026.

| # | Slide | On the slide | Speaker and gist |
| --- | --- | --- | --- |
| 1 | Food Safety Follow-Up | Title; one line: "One place to connect a city inspection finding to a documented corrective action."; both names and "L2 Showcase, 12 November 2026"; footer: independent course project, not affiliated with sweetgreen, with the link to the posting | Dennys: introduces both of us and the project, built around the Senior Food Safety Manager role in New York |
| 2 | Who we are | Two cards, Dennys first: product requirements, repository, screens, showcase film; then the back end (city data import, permit matching, flag rules), the demo script, and the deck | Dennys, then Valerie: each states the part built |
| 3 | Why we chose the Senior Food Safety Manager job | Three cards: public records, a gap (public data shows the finding; only a person can record the correction), a good fit (prior work with the inspection data) | Valerie: why the job; the three hard parts; public records show what an inspector found, not what the company did afterward |
| 4 | The job is tracking findings across restaurants and proving action | Two columns: what the posting says (reviews audits and sanitation violations, drives corrective action, documents the work, reports risk) and what that means day to day (chasing findings, remembering which violations come back, keeping proof that someone acted) | Dennys: the duties, and the focus on follow-through |
| 5 | One slice of the job: from a city finding to a corrective action | Three cards: public findings for 38 restaurants, demo checks (fictional, labeled), manager decisions. Beneath: one user, no accounts, no notifications, no automatic closing | Dennys: one slice of the job; the manager chooses what to link, record, and close |
| 6 | Architecture diagram | `docs/architecture.png`, full width | Valerie: the back end matches restaurants to city permits, imports their inspections, and flags findings; the screens save follow-ups; written rules flag repeats; the manager decides |
| 7 | Play the video now | "Showcase film, about 1 minute 32 seconds"; the YouTube link | Valerie introduces the film, then it plays (the voice-over, or live narration over a muted film) |
| 8 | One view for findings, repeats, and actions | Before and after lists; three numbers: 38 restaurants connected, 271 violations on record, 45 repeat cases of a violation; "Hypothesis, not yet measured" | Dennys: the numbers, and that the before-and-after comparison is a hypothesis |
| 9 | The value is catching serious repeats and keeping proof | Risk (17 repeat cases involve a critical violation, at 14 restaurants); documentation; time (about 14 to 28 hours a year, from 85 violations at 10 to 20 minutes each, an assumption); next steps | Valerie: the case, the unmeasured time estimate, and the next steps (test with managers, set a baseline, protect access) |

## Notes

- **Timing:** practice once with a timer; the figures above are estimates. If you run long, cut the question and answer on slide 8 first.
- **Slide 6** is the diagram, shown full width. Use the 3200 by 1800 PNG. The text is small, so say the three points aloud instead of reading it.
- **Slide 7:** test the YouTube link and the sound on the showcase computer before the session; keep a local copy of the film as a backup. Return to slide 8 when it ends.
- **Numbers on slides 8 and 9** are as of 9 November 2026. Refresh them with `npm run data:status` only if you also re-record the film, so the two agree.
- **Quote the posting sparingly.** Paraphrase the duties, as above, and link to it.
- **Do not claim** the app uses AI, that it reduces violations, or that any restaurant is unsafe.
- **Plain wording:** the speaker lines lead with the outcome and use the job description's words ("corrective action," "documentation," "violations"). See `plain-language.md` for the one-minute version and the swap table.
