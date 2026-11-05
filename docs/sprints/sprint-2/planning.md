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

Sprint 1 completed 22 points in 30 hours, so 40 hours is about 29 points. We committed 30 and wrote down what we drop first if we fall behind.

## Committed issues
| Issue | Title | Points | Owner | Depends on |
| --- | --- | --- | --- | --- |
| #7 | Create a team and join via invite link | 5 | Ziqi | #6 |
| #8 | Create sprints with dates and requirements | 3 | Yunhong | #7 |
| #9 | Submit and edit a daily standup | 3 | Ziqi | #8 |
| #11 | Receive and verify GitHub webhooks | 5 | Yunhong | #7 |
| #12 | Show live contribution dashboard | 5 | Ziqi | #9, #10, #11 |
| #16 | Publish public API v1 with tokens and OpenAPI docs | 5 | Ziqi | #10 |
| #17 | Set up environments, security scanning and an E2E stage in CI | 3 | Yunhong | #4 |
| #41 | Record Sprint 2 Scrum artifacts | 1 | Ziqi | #18 |
| | **Total** | **30** | Ziqi 19 · Yunhong 11 | |

#7, #8 and #9 (11 points) carry over from Sprint 1. Across both sprints the split is Ziqi 28 and Yunhong 24 (Sprint 1 completed: Ziqi 9, Yunhong 13).

## Cut from Sprint 2
The draft proposed 33 new points plus the 11 carried over, 44 in total, and #41 adds 1. These go to the Backlog (15 points):

| Issue | Title | Points |
| --- | --- | --- |
| #13 | Run a retro with voting and action items | 5 |
| #14 | Collect private peer feedback for instructors | 3 |
| #15 | Add instructor view and Markdown export | 5 |
| #43 | Add E2E tests for the five user flows (split from #17) | 2 |

Why these: P2 asks for retros with partner feedback, and we already record them in `docs/sprints/`. It also asks for OpenAPI docs (#16), security scanning and separate environments (#17), so those stay. #17 asked for E2E tests of all five user flows in `AGENTS.md` §2, but flows 4 and 5 need #13–#15, so that part moved to #43 and #17 went from 5 points to 3. The cost: two success measures in `docs/PRD.md` §10 won't be met by Nov 12, because our records won't be exported from the app and there's no single instructor page.

## If we fall behind
Drop in this order:
1. Moving `requirement-status.ts` (#10) to `"YYYY-MM-DD"` strings (already a stretch goal, see Decisions).
2. The Swagger UI at `/api-docs` in #16. `docs/api/openapi.yaml` stays.
3. Live Pusher updates in #12. The dashboard stays and shows new activity after a reload.

## Order of work
1. Ziqi starts #7 on Nov 5, since #8, #9, #11 and #16 all need teams.
2. Yunhong starts with the environments part of #17: preview and production databases on Supabase, migrations applied to both, and a decision record for database hosting. Ziqi creates the GitHub OAuth Apps (development and production) and sets the Vercel environment variables. Connection strings are shared privately, never in a PR or a doc. Sign-in on production (#6) works once both halves are done.
3. Yunhong then builds the #11 mappers in `src/lib/github/` on fixture payloads, and the security scanning and E2E stage of #17.
4. After #7 merges: Yunhong does the #8 route, repository and UI; Ziqi does #9.
5. Yunhong merges #11. Ziqi builds #12 against fixtures until then, so it doesn't wait for the merge.
6. Ziqi does #16.

## Decisions
- New code in `src/lib/` takes calendar dates as `"YYYY-MM-DD"` strings (Yunhong's proposal in #40). Prisma returns `@db.Date` columns as UTC midnight, and the HW3 runs tripped on UTC versus team-timezone midnight. Yunhong adds the rule to `AGENTS.md` with a Changelog row under #8, naming `requirement-status.ts` (#10) as the one known exception.
- Moving `requirement-status.ts` to strings is a stretch goal, after #8's route, repository and UI. It already accepts sprint dates at UTC midnight, so #12 can pass Prisma's values to it without waiting.

## Working agreements
- One branch per issue; partner reviews every PR before merge; no squash merges.
- Standups: each of us posts at least 3 this sprint in our own file under `standups/`, on the day.
- Failing tests are committed before implementation for all logic and API work.
- When starting an issue that touches the other person's code, send a short message first (from Yunhong's Sprint 1 feedback).

## Risks
- #7 blocks four issues, the same kind of chain that held up Sprint 1. A one-day slip on #7 delays #8, #9, #11 and #16.
- 30 points is 1 over our estimate, and the P2 deliverables outside the board (demo video, individual reflections, contribution log, architecture diagram) need time this week too. The drop order above says what goes first.
- Sign-in on production needs both the Supabase databases (Yunhong) and the OAuth Apps and Vercel variables (Ziqi). Until both are done, the app only runs locally.
- Pusher on Vercel: verify the free tier limits early.
