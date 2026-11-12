# Contribution log

> **Draft, finalized after the Sprint 2 retro.** Built only from git and GitHub history as of 2026-11-11: issues, merged pull requests and their reviews, decision records, standup files and commits on `main`. It lists what each person did; it doesn't score or compare anyone.

| Member | GitHub | Role |
| --- | --- | --- |
| Ziqi (Odie) Yang | [@Odiethebest](https://github.com/Odiethebest) | Product, design and app features |
| Yunhong Huang | [@santiaojun](https://github.com/santiaojun) | Platform and core logic |

## Ziqi (Odie) Yang

### Issues

- **Assigned and closed:** #1 PRD, #2 mockups and design tokens, #6 sign in with GitHub, #7 teams and invite links, #9 daily standups, #12 live dashboard, #15 review page and Markdown export, #16 public API v1, #18 Sprint 1 Scrum artifacts, #56 standups follow their days, #62 button contrast, #71 webhook delivery races, #72 Pusher timeouts and error page, #73 standup calendar boundaries, #74 input validation, #75 transaction races, #76 form feedback, #77 keyboard accessibility, #90 NUL in webhook text and commit insert order, #91 unsent standup text across a day change, #92 days left for an upcoming sprint, #93 team sign-in callback and navigation, #97 teams API and the 500 error shape, #98 automatic migrations, health check and coverage, #99 sprint windows without the host time zone, #100 404 page.
- **Assigned, open:** #41 Sprint 2 Scrum artifacts.
- **Opened:** the Sprint 1 and 2 backlog (#1–#18, #41, #43, #53, #57), the Nov 9 bug audit issues (#62, #71–#78), the Nov 10 follow-ups from Yunhong's reviews (#90–#94), and the Nov 11 issues #97–#100.

### Pull requests authored (merged)

- **Features:** #37 GitHub sign-in (#6), #44 teams and invite links (#7), #51 daily standups (#9), #58 sprint dashboard (#12), #60 live dashboard updates through Pusher (#12), #64 personal API tokens (#16), #65 and #66 read-only API and OpenAPI docs (#16; #65 merged into the #64 branch, #66 into `main`), #106 listing and reading teams through the API, and 500 `INTERNAL_ERROR` for unexpected errors (#97), #108 read-only review page and Markdown export (#15).
- **Fixes:** #24 token-only placeholder page (#3), #34 CI runs on `main` no longer cancelled (#17), #63 button hover contrast (#62), #69 standups keep their days (#56), #79 webhook delivery races (#71), #80 Pusher timeouts and team error page (#72), #81 standup day and stale forms (#73), #82 inputs that returned 500 (#74), #83 advisory locks for sprint, invite and repo writes (#75), #84 settings and standup form feedback (#76), #85 keyboard focus and announcements (#77), #101 no days left before a sprint starts (#92), #102 NUL in webhook text and commits in SHA order (#90), #103 team sign-in callback and current page in the navigation (#93), #107 unsent standup text kept across a day change (#91), #109 404 page (#100), #110 sprint windows without the host time zone, with three `refactor` commits that leave one implementation of each counting rule (#99).
- **Platform and CI:** #104 migrations applied after every merge, `/api/health`, the production smoke test and coverage thresholds (#98).
- **Tests:** #105 E2E for GitHub activity reaching a teammate's live dashboard, flow 3 of #43.
- **Docs:** #20 peer feedback rule covers exports (#1), #22 prototype screenshots and AGENTS.md §2 (#2), #26 production link (#4), #29 rules file experiment results (#10), #35 decision 001 OAuth scopes (#6), #45 AGENTS.md and README synced with the teams code (#7), #52 hosted env setup and the #11 migration (#17), #70 local Supabase password variables (#17), #87 Supabase pooler URIs in `.env.example` (#17).
- **Scrum records:** #19 Sprint 1 planning, #38 and #39 Sprint 1 retro (#18), #42 Sprint 2 planning (#41), standups #25, #31, #32, #48, #54, #67.
- **Open:** #95 Sprint 2 retro draft (#41).

### Commits in Yunhong's pull requests

- #47 (#8): 3 commits, Zod validation of sprint bodies with `requireTeamRole`, its failing tests, and the current sprint row token.
- #49 (#11): 4 commits, failing closed without a secret and validating payloads, its failing tests, the last delivery time in Settings, and the commit counting rule in the docs.
- #61 (#17): 1 commit, running the live update specs against a Soketi container.

### Reviews given

Approving or change-requesting reviews on Yunhong's merged PRs: #21, #23, #27, #28, #30, #33, #36, #40, #46, #47 (changes requested, then approved), #49 (changes requested, then approved), #50, #55, #59, #86, #96. A review on #61 was later dismissed. All 21 submitted reviews on merged PRs have a written body.

### Decision records

- [001 GitHub OAuth scopes](decisions/001-github-oauth-scopes.md)
- [003 Standups belong to days](decisions/003-standups-belong-to-days.md)
- The decision record template ([000](decisions/000-template.md))
- Edits to [002](decisions/002-database-hosting.md) in #52, #70, #87 and #104.

### Operations outside git history

- Nov 7: the production GitHub OAuth App, and Vercel env vars for Production and Preview (recorded in #52).
- Nov 9: applied the `api_tokens` migration from #64 to both Supabase databases. Nov 9–10: applied the standups migration from #56 to preview, then to production after #69 merged.
- Nov 11: `DATABASE_URL` secrets in the GitHub environments `preview` and `production`, limited to protected branches, so `database.yml` (#98) migrates both databases after every merge.
- Nov 11: the repository webhook pointing at production, with a new webhook secret; Pusher Channels for live updates in production (Vercel env vars, then a redeploy); "E2E tests" and "Dependency audit" added to the required checks on `main`.
- Nov 11: replaced the empty placeholder team on production with the team SprintProof (both partners LEAD), Sprint 1 and 2, the 12 standups from `docs/sprints/`, and the repository's GitHub history since Oct 28 mapped to activity with the webhook rules.

### Standups

- Sprint 1 ([`sprint-1/standups/ziqi.md`](sprints/sprint-1/standups/ziqi.md)): Oct 29, Oct 30, Oct 31.
- Sprint 2 ([`sprint-2/standups/ziqi.md`](sprints/sprint-2/standups/ziqi.md)): Nov 6, Nov 7, Nov 9.

### Commits

153 non-merge commits on `main` (40 `test`, 19 `feat`, 25 `fix`, 3 `refactor`, the rest `docs` and `chore`), including the initial repository setup.

## Yunhong Huang

### Issues

- **Assigned and closed:** #3 scaffold Next.js with Vitest and Playwright, #4 CI pipeline and Vercel deployments, #5 Prisma schema and database connection, #8 sprints with dates and requirements, #10 requirement status per member, #11 GitHub webhooks, #17 environments, security scanning and E2E stage in CI, #68 OpenAPI coverage test on Windows, #89 docs for the end of Sprint 2 (#88, a duplicate of it, closed as done by the same PR).
- **Opened:** #56 (from the review of PR #51), #68, #88, #89.

### Pull requests authored (merged)

- **Features:** #30 requirement status per member (#10), #36 Prisma schema, client and integration test setup (#5), #40 sprint date, overlap and quota validation (#8), #47 create and edit sprints (#8), #49 receive and verify GitHub webhooks (#11).
- **Platform and CI:** #21 Next.js scaffold with Vitest and Playwright (#3), #23 multi-stage CI pipeline and status badge (#4), #59 CodeQL, npm audit and dependency review (#17), #61 E2E stage, production guard and Postgres 17 (#17).
- **Tests:** #86 line endings in the OpenAPI coverage test (#68).
- **Docs:** #28 AGENTS.md v2 rules from the experiment findings (#10), #46 decision 002 database hosting (#17), #96 README feature status, the schema diagram in `docs/architecture.md` and the first draft of this log (#89).
- **Scrum records:** standups #27, #33, #50, #55.

### Commits in Ziqi's pull requests

- #39 (#18): 1 commit, Yunhong's partner feedback in the Sprint 1 retro.

### Reviews given

Approving or change-requesting reviews on Ziqi's merged PRs: #19, #20, #22, #24, #25, #26, #29, #31, #32, #34, #35, #37, #38, #39, #42, #44, #45, #48, #51, #52, #54, #64, #65 (changes requested, then approved), #66, #67, #69, #70, #80, #81, #84, #87. A review on #85 was later dismissed. 40 of the 42 submitted reviews on merged PRs have a written body.

### Operations and findings outside git history

- Applied the #11 migration to sprintproof-prod and sprintproof-preview after #49 merged (Nov 6), and reset the production database password; see my review comment on #52.
- Found in review: the past-midnight standup bug in my review of #51 (fixed in #73 / #81), and the sprint-date edge case that became #56.
- Reproduced the Windows CRLF failure of the OpenAPI coverage test while reviewing #65 and #66; fixed it in #86 (#68).
- Points from my reviews of #79–#85 became issues #90–#94 (opened Nov 10).

### Decision records

- [002 Database hosting](decisions/002-database-hosting.md), plus one later edit in #61.

### Standups

- Sprint 1 ([`sprint-1/standups/yunhong.md`](sprints/sprint-1/standups/yunhong.md)): Oct 29, Nov 1, Nov 4.
- Sprint 2 ([`sprint-2/standups/yunhong.md`](sprints/sprint-2/standups/yunhong.md)): Nov 5, Nov 6, Nov 7.

### Commits

34 non-merge commits on `main` (7 `test`, 6 `feat`, 2 `fix`, the rest `docs`, `chore` and `style`).

## Shared work

- **Rules file experiment (#10):** Ziqi ran the WITHOUT round and wrote the reference tests; Yunhong ran the WITH rounds (v1 and v2) and wrote the AGENTS.md v2 rules (#28, Changelog 2026-10-29); Ziqi recorded the results (#29) ([`research/rules-before-after.md`](research/rules-before-after.md)).
- **AGENTS.md:** both partners wrote v1 (Changelog 2026-10-28). Later Changelog rows are by Ziqi for the AI-commit rule (no issue), #1, #2, #5, #6, #7, #9, #11, #12, #15, #16, #56, #73, #74, #90, #91, #93, #97, #98 and #99, and by Yunhong for #1 (bots), #3, #8, #10, #17 and the per-person standup files.
- **Sprint retros:** the Sprint 1 retro ([`sprint-1/retro.md`](sprints/sprint-1/retro.md)) has both partners' items and feedback (#38, #39). The Sprint 2 retro is drafted in open PR #95 (#41) and isn't merged yet.

## Process notes

- Ziqi merged all 65 merged PRs, both partners'.
- 20 of them had no approving review from the partner when they merged: #58, #60, #63, #79, #80, #81, #82, #83 and #101–#110 had no approval yet, and #61 and #85 had their approval dismissed by a later push. They went in through the repository owner's admin override of the required review.
- Counts come from `git log --no-merges` on `main` and from the pull requests' reviews on GitHub. Commit counts include docs and standup commits, so they say how history is split, not how much work each commit was.

## To finalize after the Sprint 2 retro

- [ ] Add the Sprint 2 retro results and partner feedback.
- [x] Add PRs merged after 2026-11-10 (#96, #101–#110).
- [ ] Add #95 once it merges.
- [ ] Both partners read this file and confirm it, then drop the "Draft" note.
