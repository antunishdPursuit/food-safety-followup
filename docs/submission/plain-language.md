# Plain-language explanation (LaNice's lesson of 2026-11-09)

The lesson: lead with the outcome, use the job description's own words, and run the jargon test (would a new hire follow every word?). Her Team Debrief at 14:00 ET asks for the product in one minute with zero technical terms, and for one plain-language sentence that defines a good explanation.

## One minute, zero technical words

Four parts, in order: Who, Problem, Does, Changes. About 125 words, under a minute.

**Who:**  A food safety manager for a restaurant group in New York.

**Problem:**  The city inspects every restaurant and lists its violations. The manager must review them, make sure each one is corrected, write down what was done, and notice when a violation comes back. That means chasing findings across many restaurants.

**Does:**  Food Safety Follow-Up puts every restaurant's inspection findings on one screen, shows which ones have no linked follow-up in this prototype, shows when the same violation returns, and lets the manager record who will fix it, by when, and what was done.

**Changes:**  The manager sees at a glance which findings still need action, catches repeat violations early, and keeps a written record that each correction was made and signed off by a person.

## One sentence for the debrief (a draft to adjust)

"A good explanation tells the person what they can now do, in the words of their own job, and a new hire would follow every word."

## Swap table: technical word to the job description's word

The posting's own words include "audits," "sanitation violations," "corrective action," "documentation," and "risk."

| Instead of | Say |
| --- | --- |
| follow-up | corrective action |
| citation | violation |
| flag; needs review | an item that needs attention; a finding with no linked follow-up in this prototype |
| repeat code; repeat flag | the same violation coming back |
| regional signal | the same violation at several restaurants |
| points; severity; condition level | leave out: the city data has none |
| cure | the restaurant's proof of correction to the city; the violation stays on the record |
| match to a permit | connect each restaurant to its official city record |
| import; refresh | bring in the latest inspection results |
| audit trail | documentation |
| fictional demo check | a made-up internal check, labeled as made up |
| durable storage; protected sign-in | a safer place to keep records; a login |
| prototype | working model |
| backend; API; store | leave out; say "the tool keeps the record" |

## Jargon test on the first drafts

Sentences from the deck outline and demo script that failed, and what replaced them (both files now use the new wording):

- "Public pages and city data flow through matching and import into one store. Rules raise flags." Failed on matching, import, store, rules, flags. Replaced with plain wording about connecting each restaurant to its official record and written rules marking what needs attention.
- "45 repeat flags at 25 locations." Failed on repeat flags and locations. Now "45 cases of the same violation coming back, at 25 restaurants."
- "durable storage and protected sign-in." Failed on both. Now "a safer place to keep records and a login."

The architecture slide keeps its technical labels because the submission asks for the architecture. Say it plainly aloud, as slide 4's speaker line does.
