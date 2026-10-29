# Sprint 1 planning

**Dates:** Oct 29 – Nov 4, 2026 · **Milestone:** Sprint 1
**Planned by:** Ziqi (Odie) Yang, Yunhong Huang · **Planning meeting:** 2026-10-28

## Sprint goal
A team can sign in with GitHub, set up sprints with requirements, post daily standups, and get requirement status computed correctly by tested business logic.

## Capacity
| Member | Available hours | Notes |
| --- | --- | --- |
| Ziqi (Odie) Yang | 15 | |
| Yunhong Huang | 15 | |

## Committed issues
| Issue | Title | Points | Owner | Depends on |
| --- | --- | --- | --- | --- |
| #1 | Write PRD with user stories and acceptance criteria | 2 | Ziqi | — |
| #2 | Create UI mockups and design tokens | 3 | Ziqi | — |
| #3 | Scaffold Next.js app with Vitest and Playwright | 2 | Yunhong | — |
| #4 | Set up CI pipeline and Vercel deployments | 3 | Yunhong | #3 |
| #5 | Set up Prisma schema and database connection | 3 | Yunhong | #3 |
| #6 | Sign in with GitHub | 3 | Ziqi | #5 |
| #7 | Create a team and join via invite link | 5 | Ziqi | #6 |
| #8 | Create sprints with dates and requirements | 3 | Yunhong | #7 |
| #9 | Submit and edit a daily standup | 3 | Ziqi | #8 |
| #10 | Compute requirement status per member | 5 | Yunhong | — |
| #18 | Record Sprint 1 Scrum artifacts | 1 | Ziqi | — |
| | **Total** | **33** | Ziqi 17 · Yunhong 16 | |

## Working agreements
- One branch per issue; partner reviews every PR before merge; no squash merges.
- Standups: each of us posts at least 3 this sprint in our own file under `standups/`.
- Failing tests are committed before implementation for all logic and API work.
- HW3 experiment on #10: Ziqi runs the without-rules round, Yunhong the with-rules round, from the same `main` commit.

## Risks
- #6–#9 depend on the scaffold and schema (#3, #5); Ziqi works on #1 and #2 first so nobody waits.
- GitHub OAuth scope decision may affect #11 later; record it in `docs/decisions/001-github-oauth-scopes.md`.
