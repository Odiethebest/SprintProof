# Contribution log

> **Draft, finalized after the Sprint 2 retro.** Built only from git and GitHub history as of 2026-11-10: issues, merged pull requests and their reviews, decision records, standup files and commits on `main`. It lists what each person did; it doesn't score or compare anyone.

| Member | GitHub | Role |
| --- | --- | --- |
| Ziqi (Odie) Yang | [@Odiethebest](https://github.com/Odiethebest) | Product, design and app features |
| Yunhong Huang | [@santiaojun](https://github.com/santiaojun) | Platform and core logic |

## Ziqi (Odie) Yang

### Issues

- **Assigned and closed:** #1 PRD, #2 mockups and design tokens, #6 sign in with GitHub, #7 teams and invite links, #9 daily standups, #12 live dashboard, #16 public API v1, #18 Sprint 1 Scrum artifacts, #56 standups follow their days, #62 button contrast, #71 webhook delivery races, #72 Pusher timeouts and error page, #73 standup calendar boundaries, #74 input validation, #75 transaction races, #76 form feedback, #77 keyboard accessibility.
- **Assigned, open:** #41 Sprint 2 Scrum artifacts.
- **Opened:** the Sprint 1 and 2 backlog (#1–#18, #41, #43, #53, #57) the Nov 9 bug audit issues (#62, #71–#78), and the Nov 10 follow-ups (#90–#94).

### Pull requests authored (merged)

- **Features:** #37 GitHub sign-in (#6), #44 teams and invite links (#7), #51 daily standups (#9), #58 sprint dashboard (#12), #60 live dashboard updates through Pusher (#12), #64 personal API tokens (#16), #65 and #66 read-only API and OpenAPI docs (#16; #65 merged into the #64 branch, #66 into `main`).
- **Fixes:** #24 token-only placeholder page (#3), #34 CI runs on `main` no longer cancelled (#17), #63 button hover contrast (#62), #69 standups keep their days (#56), #79 webhook delivery races (#71), #80 Pusher timeouts and team error page (#72), #81 standup day and stale forms (#73), #82 inputs that returned 500 (#74), #83 advisory locks for sprint, invite and repo writes (#75), #84 settings and standup form feedback (#76), #85 keyboard focus and announcements (#77).
- **Docs:** #20 peer feedback rule covers exports (#1), #22 prototype screenshots and AGENTS.md §2 (#2), #26 production link (#4), #29 rules file experiment results (#10), #35 decision 001 OAuth scopes (#6), #45 AGENTS.md and README synced with the teams code (#7), #52 hosted env setup and the #11 migration (#17), #70 local Supabase password variables (#17), #87 Supabase pooler URIs in `.env.example` (#17).
- **Scrum records:** #19 Sprint 1 planning, #38 and #39 Sprint 1 retro (#18), #42 Sprint 2 planning (#41), standups #25, #31, #32, #48, #54, #67.
- **Open:** #95 Sprint 2 retro draft (#41).

### Commits in Yunhong's pull requests

- #47 (#8): 3 commits, Zod validation of sprint bodies with `requireTeamRole`, its failing tests, and the current sprint row token.
- #49 (#11): 4 commits, failing closed without a secret and validating payloads, its failing tests, the last delivery time in Settings, and the commit counting rule in the docs.
- #61 (#17): 1 commit, running the live update specs against a Soketi container.

### Reviews given

Approving or change-requesting reviews on Yunhong's merged PRs: #21, #23, #27, #28, #30, #33, #36, #40, #46, #47 (changes requested, then approved), #49 (changes requested, then approved), #50, #55, #59, #86. A review on #61 was later dismissed. 20 submitted reviews on merged PRs have a written body.

### Decision records

- [001 GitHub OAuth scopes](decisions/001-github-oauth-scopes.md)
- [003 Standups belong to days](decisions/003-standups-belong-to-days.md)
- The decision record template ([000](decisions/000-template.md))
- Edits to [002](decisions/002-database-hosting.md) in #52, #70 and #87.

### Standups

- Sprint 1 ([`sprint-1/standups/ziqi.md`](sprints/sprint-1/standups/ziqi.md)): Oct 29, Oct 30, Oct 31.
- Sprint 2 ([`sprint-2/standups/ziqi.md`](sprints/sprint-2/standups/ziqi.md)): Nov 6, Nov 7, Nov 9.

### Commits

112 non-merge commits on `main` (26 `test`, 16 `feat`, 17 `fix`, the rest `docs` and `chore`), including the initial repository setup.

## Yunhong Huang

### Issues

- **Assigned and closed:** #3 scaffold Next.js with Vitest and Playwright, #4 CI pipeline and Vercel deployments, #5 Prisma schema and database connection, #8 sprints with dates and requirements, #10 requirement status per member, #11 GitHub webhooks, #17 environments, security scanning and E2E stage in CI, #68 OpenAPI coverage test on Windows.
- **Assigned, open:** #89 docs for the end of Sprint 2 (#88 is a duplicate of it).
- **Opened:** #56 (from the review of PR #51), #68, #88, #89.

### Pull requests authored (merged)

- **Features:** #30 requirement status per member (#10), #36 Prisma schema, client and integration test setup (#5), #40 sprint date, overlap and quota validation (#8), #47 create and edit sprints (#8), #49 receive and verify GitHub webhooks (#11).
- **Platform and CI:** #21 Next.js scaffold with Vitest and Playwright (#3), #23 multi-stage CI pipeline and status badge (#4), #59 CodeQL, npm audit and dependency review (#17), #61 E2E stage, production guard and Postgres 17 (#17).
- **Tests:** #86 line endings in the OpenAPI coverage test (#68).
- **Docs:** #28 AGENTS.md v2 rules from the experiment findings (#10), #46 decision 002 database hosting (#17).
- **Scrum records:** standups #27, #33, #50, #55.

### Commits in Ziqi's pull requests

- #39 (#18): 1 commit, Yunhong's partner feedback in the Sprint 1 retro.

### Reviews given

Approving or change-requesting reviews on Ziqi's merged PRs: #19, #20, #22, #24, #25, #26, #29, #31, #32, #34, #35, #37, #38, #39, #42, #44, #45, #48, #51, #52, #54, #64, #65 (changes requested, then approved), #66, #67, #69, #70, #80, #81, #84, #87. A review on #85 was later dismissed. 40 submitted reviews on merged PRs have a written body.
### Operations and findings outside git history

- Applied the #11 migration to sprintproof-prod and sprintproof-preview after #49 merged (Nov 6), and reset the production database password; see my review comment on #52.
- Found in review: the past-midnight standup bug in my review of #51 (fixed in #73 / #81), and the sprint-date edge case that became #56.
- Reproduced the Windows CRLF failure of the OpenAPI coverage test while reviewing #65 and #66; fixed it in #86 (#68).
### Decision records

- [002 Database hosting](decisions/002-database-hosting.md), plus one later edit in #61.

### Standups

- Sprint 1 ([`sprint-1/standups/yunhong.md`](sprints/sprint-1/standups/yunhong.md)): Oct 29, Nov 1, Nov 4.
- Sprint 2 ([`sprint-2/standups/yunhong.md`](sprints/sprint-2/standups/yunhong.md)): Nov 5, Nov 6, Nov 7.

### Commits

33 non-merge commits on `main` (7 `test`, 6 `feat`, 2 `fix`, the rest `docs`, `chore` and `style`).

## Shared work

- **Rules file experiment (#10):** Ziqi ran the WITHOUT round and wrote the reference tests; Yunhong ran the WITH rounds (v1 and v2) and wrote the AGENTS.md v2 rules (#28, Changelog 2026-10-29); Ziqi recorded the results (#29) ([`research/rules-before-after.md`](research/rules-before-after.md)).
- **AGENTS.md:** both partners wrote v1 (Changelog 2026-10-28). Later Changelog rows are by Ziqi for the AI-commit rule (no issue), #1, #2, #5, #6, #7, #9, #11, #12, #16, #56, #73 and #74, and by Yunhong for #1 (bots), #3, #8, #10, #17 and the per-person standup files.
- **Sprint retros:** the Sprint 1 retro ([`sprint-1/retro.md`](sprints/sprint-1/retro.md)) has both partners' items and feedback (#38, #39). The Sprint 2 retro is drafted in open PR #95 (#41) and isn't merged yet.

## Process notes

- These merged PRs have no approving review on record: #58, #60, #63, #79, #82, #83 (no review), and #61, #85 (the review was dismissed). To be confirmed at the Sprint 2 retro.
- Counts come from `git shortlog --no-merges` on `main` and from `gh pr view --json reviews`. Commit counts include docs and standup commits, so they say how history is split, not how much work each commit was.

## To finalize after the Sprint 2 retro

- [ ] Add the Sprint 2 retro results and partner feedback.
- [ ] Add PRs merged after 2026-11-10 (for example #95 and this issue's PR for #89).
- [ ] Both partners read this file and confirm it, then drop the "Draft" note.
