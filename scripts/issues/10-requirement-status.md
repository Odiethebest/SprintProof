## User story
As someone who hates deadline surprises, I want the app to tell me which requirements I've met and what's left, so I can fix gaps in time.

## Acceptance criteria
- [ ] Pure function in `src/lib/checks/` that takes a sprint, members, standups, activities and `now`, and returns, for each member and each requirement: `count`, `required`, `remaining`, `status`
- [ ] Standups: at most one per member per day in the team timezone (R2)
- [ ] Reviews: distinct PRs reviewed, only on PRs authored by someone else (R3)
- [ ] Activity from bot logins (ending in `[bot]`) is ignored (R4)
- [ ] Status follows R5 exactly: `MET`, `ON_TRACK`, `AT_RISK` (2 or fewer days left), `MISSED`
- [ ] No I/O: no Prisma, no `fetch`, no `new Date()` inside the function
- [ ] Unit tests cover: empty sprint; member with no activity; multiple reviews on the same PR; review on own PR; bot activity; standup at 23:59 and 00:00 on a sprint boundary; each status
- [ ] Coverage of `src/lib/checks/` ≥ 90%
- [ ] Failing tests committed before implementation

**Estimate:** 5 points
**PRD:** US-5, rules R1–R5
**Note:** This is the feature used for the HW3 with/without rules experiment.
