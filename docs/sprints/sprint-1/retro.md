# Sprint 1 retrospective

**Date:** 2026-11-04 · **Attendees:** Ziqi (Odie) Yang, Yunhong Huang

## Results
| | Planned | Completed |
| --- | --- | --- |
| Issues | 11 | 8 (#1–#6, #10, and #18 with this retro) |
| Story points | 33 | 22 |

Not done, carried into Sprint 2: #7 (5), #8 (3), #9 (3) = 11 points.

Sprint goal met? Partly. Sign-in with GitHub (#6) and requirement status (#10) work and are tested. Teams, sprint setup and standups (#7–#9) are not built yet. They depend on #5 → #6 in a single chain, and #5 and #6 both merged on Nov 4, the last day.

| P2 requirement | Ziqi (Odie) Yang | Yunhong Huang | Required |
| --- | --- | --- | --- |
| Standups | 3 | 3 | 3 |
| PRs reviewed (distinct, authored by the partner) | 7 | 12 | 5 |

## Went well
- Every PR was reviewed by the partner before merge, and branch protection held. No squash merges, so the test-first commits stay in history.
- The v2 rules from the HW3 experiment held up in #6: the failing tests (`2afef71`) landed before the implementation (`c12ec9e`), and `src/lib/` takes one input shape.
- The foundation is in place: scaffold, CI, Vercel previews, Prisma schema, sign-in, and the requirement status logic.
- Yunhong stopped at a checkpoint to review the Prisma schema before the first migration and changed it (one standup per person per day, GitHub event time, calendar dates for sprints).
- The E2E test caught a sign-in redirect bug in `src/proxy.ts` that `next build` passed.
- Yunhong added a Postgres service to CI in #36, so integration tests now run against a real database.

## To improve
<!-- Each person has 3 votes. Top 3 become action items. -->
| Item | Votes |
| --- | --- |
| #5 and #6 both merged on the last day, so #7–#9 had no time. The #5 → #9 chain was serial and the work wasn't split to overlap. | 2 |
| We planned 33 points with no buffer for a 4-issue dependency chain. The Sprint 2 draft already has 33 points, plus 11 carried over. | 2 |
| Some approvals had one-word bodies or came before CI finished (#33, #35, #36, #37). The PR template asks for green CI and a substantive comment. The User migration in #37 was never confirmed in review. | 1 |
| CI gaps were found late: the concurrency setting cancelled two runs on `main` (fixed in #34), and integration tests had no database in CI until #36. | 1 |
| #34 and #35 waited two days for review (opened Nov 2, merged Nov 4). | 0 |
| Red-step PRs fail CI and the Vercel build, because `next build` typechecks the tests. This isn't written down anywhere (open them as drafts). | 0 |
| Follow-ups from #36 are still open: no decision record for Supabase hosting, `dotenv` used but not in `package.json`, and the author on the Prisma pin row of the `AGENTS.md` Changelog. | 0 |

## Action items for the next sprint
<!-- Top 3 "To improve" items by votes (ties: earliest listed). -->
- [ ] Merge blocking issues first (#11, then #12) and start dependent work on fixtures instead of waiting for the blocker to merge. Owner: Yunhong
- [ ] Plan Sprint 2 within our capacity at the Nov 5 planning meeting, and list what we cut from the 44 proposed points. Owner: Ziqi
- [ ] Approve only after CI is green, with at least one substantive comment, and say explicitly when a migration was checked. Owner: Ziqi and Yunhong

## AI-assisted development
**Tools:** Ziqi used Claude Code; Yunhong used Antigravity. Both read the same `AGENTS.md` (Claude Code through `CLAUDE.md`).

**What we changed in `AGENTS.md` and why** (see its Changelog):
- v2 rules from the HW3 experiment on #10: one input shape per function in `src/lib/`, a red checkpoint where the AI stops after the failing tests, a written definition of days left, and a lint rule against non-null assertions in `src/`. Both experiment rounds had hedged the interface, committed tests and implementation together, or got days left wrong.
- §2 rewritten to match the prototype screenshots (#2), and the peer feedback rule extended to exports (#1 review).
- Tech stack versions pinned as each issue added them (#3, #5, #6).

**What worked:**
- The red checkpoint: in #6 the AI stopped after the failing tests, and the `test` commit came before the `feat` commit.
- Reviewing AI output at a checkpoint before it becomes permanent (the Prisma schema before the first migration in #5).

**What didn't:**
- Next.js 16 rewrites `AGENTS.md` during scaffolding, so we turned it off with `agentRules: false` (#21).
- The AI's sign-in proxy passed `next build` and failed at runtime (lazy Auth.js config). Only the E2E test caught it.
- The AI found facts the rules don't cover yet: how session reads work under `cacheComponents`, where to mock `server/auth-session.ts`, and red-step PRs failing the build. These are suggested `AGENTS.md` edits for Sprint 2.

## Partner feedback
<!-- Each person writes their own section. -->
**Ziqi → Yunhong:**

Your reviews caught things I missed. On #22 you spotted that the prototype and the handbook counted days left differently, before we wrote the reference tests for #10. On #24 you ran the E2E test on Windows, which I hadn't been able to run locally. On #34 you found that the integration tests were being skipped while CI stayed green, and you fixed it in #36. You also stopped the AI at a checkpoint to review the Prisma schema before the first migration, and that's a habit I want to copy.

Two things I'd like to change. #36 opened on the last day, and #6 depended on it. A draft PR with just the schema a day or two earlier would have let me build sign-in against it in parallel. And on #35 and #37 your approvals were one word, on #37 before CI finished, and nobody confirmed the User migration there. I approved #33 and #36 with "lgtm" too, so this one is for both of us: let's write what we checked in every approval.

**Yunhong → Ziqi:**
