# Sprint 2 retrospective

**Date:** 2026-11-__ · **Attendees:** Ziqi (Odie) Yang, Yunhong Huang

<!-- DRAFT (2026-11-10). Results and the Sprint 1 action items are counted from GitHub.
     "Went well" and "To improve" are candidates for the meeting: keep, reword or drop them, then vote.
     Still blank: date, votes, action items, Yunhong's tool, partner feedback. Delete this comment when done. -->

## Results
| | Planned | Completed |
| --- | --- | --- |
| Issues | 8 | 8 (#7, #8, #9, #11, #12, #16, #17, and #41 with this retro) |
| Story points | 30 | 30 |

Added during the sprint: 10 bug issues, all closed. #56 came from Yunhong's review of #51, #62 from the axe check in the new E2E stage (#61), #68 from running the tests on Windows, and #71–#77 from a bug audit of `main` on Nov 9. Together they're 17 estimated points; #56 and #68 have no estimate.

<!-- #88 (end-of-sprint docs, Yunhong) is still open: update this line when it merges. #89 duplicates it. -->

Cut at planning and still in the Backlog: #13, #14, #15 and #43 (15 points). From the "If we fall behind" list, only the first item was dropped: `requirement-status.ts` still takes `Date`. The Swagger UI and live Pusher updates both shipped.

Sprint goal met? Yes. Creating and joining teams, sprint setup, standups, GitHub webhooks, the live dashboard, the public API with OpenAPI docs, and the CI pipeline (E2E, security scanning, separate environments) are all on `main`. <!-- Before the meeting: sign in on production and click through Standups and Dashboard. -->

| P2 requirement | Ziqi (Odie) Yang | Yunhong Huang | Required |
| --- | --- | --- | --- |
| Standups (Nov 5 – Nov 11) | 3 | 3 | 3 |
| PRs reviewed (distinct, authored by the partner) | 8 | 18 | 5 |
| PRs opened and merged | 24 | 8 | — |

### Action items from Sprint 1
| Action item | Owner | Outcome |
| --- | --- | --- |
| Merge blocking issues first and start dependent work on fixtures | Yunhong | Done. #7 merged on day 1 (Nov 5). #8, #9 and #11 merged on Nov 6, and #12 on Nov 8. |
| Plan within capacity and list what we cut | Ziqi | Done. We committed 30 points against an estimate of 29, and the cut list (#13–#15, #43) is in `planning.md`. |
| Approve only after CI is green, with at least one substantive comment, and say when a migration was checked | Ziqi and Yunhong | Partly. Most feature PRs got detailed reviews: #47 and #49 had changes requested, and the review of #51 led to #56. But 10 of 32 PRs were merged without a partner approval, and 8 approvals said only "lgtm" or "approved". |

## Went well
- All 8 committed issues are done (30 of 30 points, against 22 of 33 in Sprint 1), and we didn't have to cut the Swagger UI or live updates.
- The dependency chain didn't stall: #7 merged on day 1 (Nov 5), and #8, #9 and #11 merged the next day.
- Every logic and API PR has a failing-test commit before its implementation commit, and that includes the seven bug fixes (#79–#85). Where a PR needed a schema change, the migration came first (#44, #49, #64).
- Reviews caught real problems:
  - Ziqi's review of #49 changed who gets credit for a commit: the commit author, not the committer or the pusher.
  - Yunhong's review of #51 found the sprint-date bug that became #56.
  - Running the tests on Windows found the CRLF failure in the OpenAPI coverage test (#68).
  - Yunhong's reviews of #79–#85 became #90–#94.
- Every PR now goes through lint, typecheck, unit and integration tests, E2E (with Soketi for live updates), a production build, CodeQL, `npm audit` and dependency review. The production guard also checks daily that `E2E_TEST_AUTH` is off (#17).
- The bug audit of `main` on Nov 9 found 8 issues (#71–#78) before the P2 deadline. We fixed 7 of them the same day, each one starting from a failing test.

## To improve
<!-- Each person has 3 votes. Top 3 become action items. -->
| Item | Votes |
| --- | --- |
| 10 of 32 PRs were merged without a partner approval: #58, #60, #61 and #63 within 11 minutes around midnight on Nov 7, and #79–#83 and #85 within an hour on Nov 9. To merge #79–#85, we turned off admin enforcement on `main`'s branch protection and turned it back on afterwards. | |
| The bugs found on Nov 9 were in code that had passed review, CI and E2E: concurrent webhook deliveries dropped commits and still returned 200 (#71), standups near midnight counted on the wrong day (#73), and concurrent requests could create overlapping sprints and duplicate invites (#75). We had no tests for concurrent requests or the minutes around midnight. | |
| Unplanned bug work (17 estimated points across 10 issues) came to more than half of the 30 committed points. #71–#77 alone (16 points) were opened and merged on Nov 9. | |
| We apply migrations to Supabase by hand after merging. Production ran without #64's `api_tokens` table for about 3 hours, and without #69's standups migration for about 6. | |
| 8 approvals had no comment beyond "lgtm" or "approved" (#48, #50, #54, #55, #61, #67, #69, #70). Most of these were one-file standup PRs. | |
| The board's fields don't match the plan. #17 shows 5 points on the board but 3 in `planning.md`, #41 and #62 have no points on the board, and #56 and #68 were never estimated. | |

## Action items for the next sprint
<!-- Top 3 "To improve" items by votes (ties: earliest listed). -->
- [ ] <!-- owner: -->

## AI-assisted development
**Tools:** Ziqi used Claude Code, plus Codex for the first pass at #71–#76. Yunhong used <!-- Yunhong: tool -->. Both read the same `AGENTS.md` (Claude Code through `CLAUDE.md`).

**What we changed in `AGENTS.md` and why** (see its Changelog):
- **Rules from reviews:**
  - Commits are counted from `push` events (decision 001) and credited to the commit author, not the committer or the pusher (#11, from the #49 review).
  - Calendar dates in `src/lib/` are `'YYYY-MM-DD'` strings (#8).
  - The architecture tree and the route handler helpers in `server/api-response.ts` match the code (from Yunhong's review of #44).
- **Rules from bugs:**
  - Standups belong to a team and a day, not to a stored sprint (#56, decision 003).
  - User text rejects NUL, and an id from the URL that can't be valid is treated as unknown (#74).
  - Standups count on their stored day, and a form left open overnight gets 409 `STANDUP_DAY_CHANGED`. Sprint ends are computed as the start of the next day minus 1 ms (#73).
- **API and CI rules:**
  - API tokens only read.
  - A route change updates `docs/api/openapi.yaml` in the same PR, and a coverage test enforces it (#16).
  - CI runs CodeQL, `npm audit` and dependency review (#17).

**What worked:**
- The red checkpoint held for a second sprint: in every logic and API PR, the `test(...)` commit comes before the implementation.
- Asking the AI to audit all of `main` once the features were in. It found 8 real issues, and each fix started from a failing test.
- The OpenAPI coverage test fails when a route and `openapi.yaml` disagree, so the docs can't drift from the API.

**What didn't:**
- The AI-written code passed review, CI and E2E and still had the bugs the audit found. Neither the AI nor we wrote tests for concurrent requests or near-midnight times until then.
- Codex ran E2E only against the dev server, but CI runs the production build, so its local results weren't a good guide to CI.
- Next.js 16's `cacheComponents` keeps earlier pages in hidden `<Activity>` trees. Playwright selectors matched the hidden copies, and focus went into hidden DOM (#77). `AGENTS.md` doesn't mention this yet.
- We fixed #71–#77 in parallel worktrees from the same base, so they conflicted at merge: #72 moved the header into a layout, and #74, #76 and #77 share forms and schemas. Each later branch had to merge `main` and rerun every test.

## Partner feedback
<!-- Each person writes their own section. -->
**Ziqi → Yunhong:**

**Yunhong → Ziqi:**
