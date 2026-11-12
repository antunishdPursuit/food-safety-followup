# Business case (draft): Food Safety Follow-Up

Everything here comes from public sources and the prototype's own data. There is no sweetgreen internal data, no interview with a food safety manager, and no measured baseline. Where a number is an assumption, it says so.

## The user and the problem

The selected role reviews inspection findings across New York restaurants and documents corrective actions. Our hypothesis is that viewing public findings and recorded actions together could help track owners, due dates and repeated codes. The company's actual workflow and any improvement from this prototype have not been measured.

This is a hypothesis. The posting (sweetgreen, Senior Food Safety Manager) names reviewing audits and sanitation findings, driving corrective action to completion, and documenting it. It does not tell us how the work is done today, and an existing tool may already do this well.

## What the prototype does

This API-connected workflow is implemented. The browser walkthrough and recording rehearsal remain unverified.

It brings public NYC inspection records for 38 New York Sweetgreen locations into one view, labels every record by source, flags findings with no linked follow-up and codes that repeat, and lets the manager record a follow-up (owner, due date, notes, status) and close it with a note. It never decides compliance and never marks a finding corrected from city data.

## What the public data shows (2026-11-09)

- 38 locations matched to their city permits, with 118 inspections and 271 citations from 2022 to 2026.
- In the last 12 months: 36 inspections at 28 locations, with 85 citations, 38 of them critical.
- 45 repeat flags (the same code on different inspection dates) at 25 locations. 17 of them involve a critical citation, at 14 locations.
- One location had the same critical code cited twice 15 days apart (Chambers St, code 04N, July 2026).
- The most common code, 10F, appears at 35 of the 38 locations and is 64 of the 271 citations. Since the rules adopted in 2021 (proposed in 2020), the city files general upkeep problems under 10F, such as dirty or damaged floors, walls, and equipment, so it is a broad code and not a specific hazard.
- "Repeat" means the same code on a different inspection date at one restaurant. That is our rule, not the city's. The city data has no points or severity for a violation, so these counts are not weighted by how serious each violation was.
- Every one of the 118 inspections has at least one violation. That is normal: only 0.3 percent of New York cycle initial inspections in the last 12 months had none.

These are recorded findings in a public dataset with limited history. They are not a judgment of any restaurant.

## Where the value is

Potential value areas:

- **Risk reduction (the main case).** Repeat codes with critical citations are candidates for manager review. The prototype surfaces repeated codes by rule; any risk reduction is an untested hypothesis, not a measured result against the company's current process.
- **Documentation (the second case).** A saved owner, due date, and completion note give an audit trail that public data cannot provide. Even when a restaurant "cures" a violation with the city, the violation stays on the public record and no score or grade changes, so a written note preserves the manager's reported work. The prototype does not independently verify the correction or the person's identity.
- **Cost reduction (a modest case).** Time saved is small at this size. A rough range, with the assumption shown: 85 citations a year at 10 to 20 minutes saved each is about 14 to 28 hours a year across 38 restaurants. The 10 to 20 minutes is an **assumption**, not a measurement. This alone would not justify a product.
- **Retention and revenue.** No evidence in this project. Do not claim either.

## Limits of this case

- No baseline. Establish a baseline before setting an improvement target.
- Public data only. Citations show findings, not what the company did about them.
- Up to 99 of the 271 citations carry codes that a restaurant can cure within 7 days (an upper bound). The data cannot show which were cured.
- 17 of the 271 citations use administrative codes that the city does not score, such as calorie posting and plastic straws. They are not food-safety findings.
- The city removes violations dismissed at a hearing and drops closed restaurants, so counts can fall between refreshes.
- Matching needed a person for 9 of 38 locations, so scaling to many more restaurants would need a better review step. Run fresh on all 38, the rule alone verified 29, all of them agreeing with the final match, and offered the right permit first for the other 9. An independent building check agrees for 33 of 37 testable locations, and the two it could not settle (Hudson Yards and NoMad) agree on a map.
- The location list now comes from NYC Open Data alone. The earlier one-time read of Sweetgreen's public pages was retired on 12 November 2026, because Sweetgreen's terms of use limit automated reading. Location names are the city's street addresses (for example "Sweetgreen, 125 Chambers St"), and the confirmed permit matches are kept in `data/confirmed-matches.json`.
- Storage is a local file with no sign-in. Fine for a local demo, not for public use.
- Existing audit and compliance tools were not evaluated. If one already covers this, the case weakens.

## Success measures (proposed, targets set only after a baseline)

1. Time from a new citation to a recorded follow-up with an owner and due date.
2. Share of citations with an owner and due date within a set number of working days.
3. Repeat-code recurrence per location over six months.
4. Quality check: a manager can find a finding, read its source, and save a follow-up without help, tested with at least three managers.

## Next steps

1. Interview two or three food safety managers to learn today's process and measure a baseline.
2. Compare against existing audit and compliance tools.
3. Add durable storage and protected sign-in before any public use.
4. Group and limit flags on the screens (one location has 20), and limit the regional list.
