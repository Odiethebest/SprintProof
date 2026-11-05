# Sprint 2 planning

**Dates:** Nov 5 – Nov 11, 2026 · **Milestone:** Sprint 2
**Planned by:** Ziqi (Odie) Yang, Yunhong Huang · **Planning meeting:** 2026-11-05

## Sprint goal
A team can be created and joined, sprints set up and standups posted; GitHub activity flows into a live dashboard; the public API is documented; the full CI/CD pipeline (E2E, security scanning, separate environments) runs on every PR.

## Action items carried over from the Sprint 1 retro
- [ ] Merge blocking issues first (#11, then #12) and start dependent work on fixtures instead of waiting for the blocker to merge. Owner: Yunhong
- [ ] Plan Sprint 2 within our capacity at the Nov 5 planning meeting, and list what we cut from the 44 proposed points. Owner: Ziqi
- [ ] Approve only after CI is green, with at least one substantive comment, and say explicitly when a migration was checked. Owner: Ziqi and Yunhong

## Capacity
| Member | Available hours | Notes |
| --- | --- | --- |
| Ziqi (Odie) Yang | 20 | Last sprint before P2 is due on Nov 12 |
| Yunhong Huang | 20 | Last sprint before P2 is due on Nov 12 |

Sprint 1 completed 22 points in 30 hours, so 40 hours is about 29 points. We committed 32: part of #8 (the validation in `src/lib/sprints/`) already merged in #40, so what's left there is the route, repository and UI.

## Committed issues
| Issue | Title | Points | Owner | Depends on |
| --- | --- | --- | --- | --- |
| #7 | Create a team and join via invite link | 5 | Ziqi | #6 |
| #8 | Create sprints with dates and requirements | 3 | Yunhong | #7 |
| #9 | Submit and edit a daily standup | 3 | Ziqi | #8 |
| #11 | Receive and verify GitHub webhooks | 5 | Yunhong | #7 |
| #12 | Show live contribution dashboard | 5 | Ziqi | #9, #10, #11 |
| #16 | Publish public API v1 with tokens and OpenAPI docs | 5 | Ziqi | #10 |
| #17 | Add E2E suite, security scanning and environments | 5 | Yunhong | #4, #12 |
| #41 | Record Sprint 2 Scrum artifacts | 1 | Ziqi | #18 |
| | **Total** | **32** | Ziqi 19 · Yunhong 13 | |

#7, #8 and #9 (11 points) carry over from Sprint 1. Across both sprints the split is Ziqi 28 and Yunhong 26 (Sprint 1 completed: Ziqi 9, Yunhong 13).

## Cut from Sprint 2
The draft proposed 33 new points plus the 11 carried over, 44 in total. These go back to the Backlog (13 points):

| Issue | Title | Points |
| --- | --- | --- |
| #13 | Run a retro with voting and action items | 5 |
| #14 | Collect private peer feedback for instructors | 3 |
| #15 | Add instructor view and Markdown export | 5 |

Why these: P2 asks for retros with partner feedback, and we already record them in `docs/sprints/`. It also asks for OpenAPI docs (#16), security scanning and separate environments (#17), so those stay. The cost: two success measures in `docs/PRD.md` §10 won't be met by Nov 12, because our records won't be exported from the app and there's no single instructor page.

## Order of work
1. Ziqi starts #7 on Nov 5, since #8, #9, #11 and #16 all need teams. Meanwhile Yunhong builds the #11 mappers in `src/lib/github/` on fixture payloads, and the parts of #17 that don't depend on anything (CodeQL, `npm audit`, dependency review).
2. After #7 merges: Yunhong does the #8 route, repository and UI; Ziqi does #9.
3. Yunhong merges #11. Ziqi builds #12 against fixtures until then, so it doesn't wait for the merge.
4. Ziqi does #16. Yunhong writes the #17 E2E flows once #12 is in.

## Decisions
- Calendar dates in `src/lib/` are `"YYYY-MM-DD"` strings (Yunhong's proposal in #40). Prisma returns `@db.Date` columns as UTC midnight, and the HW3 runs tripped on UTC versus team-timezone midnight. Yunhong moves `requirement-status.ts` (#10) to strings in a follow-up PR under #8, and adds the rule to `AGENTS.md` with a Changelog row.

## Working agreements
- One branch per issue; partner reviews every PR before merge; no squash merges.
- Standups: each of us posts at least 3 this sprint in our own file under `standups/`, on the day.
- Failing tests are committed before implementation for all logic and API work.
- When starting an issue that touches the other person's code, send a short message first (from Yunhong's Sprint 1 feedback).

## Risks
- #7 blocks four issues, the same kind of chain that held up Sprint 1. A one-day slip on #7 delays #8, #9, #11 and #16.
- 32 points is 3 over our estimate, and the P2 deliverables outside the board (demo video, individual reflections, contribution log, architecture diagram) need time this week too.
- #17's dashboard E2E flow can't start until #12 is in.
- Pusher on Vercel: verify the free tier limits early.
