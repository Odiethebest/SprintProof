# Without rules: measurement (Z-E)

- BASE_SHA: 290efc0
- SETUP_SHA: c4f1718 (removes AGENTS.md, CLAUDE.md, docs/research/, scripts/issues/)
- Branch: experiment/without-rules (agent output in cc2ef1f, replayed with git am from snapshot commit 4f64e58)
- Model: Gemini 3.8 Flash High, Antigravity desktop IDE 2.28.2, Request Review
- Run: 2026-10-29, 13:27:56 to 13:54:41 PDT, in the snapshot ~/sprintproof-exp/without-rules
- Measured: 2026-10-29 by Claude Code; no business code changed, nothing committed
- Raw output: ~/sprintproof-results/raw/without/ (01-git … 07-coverage-src-lib, adapter.without.ts)

## Metrics

| Metric | Without |
| --- | --- |
| Files created / changed | 17 created, 0 changed |
| Lines added | 2290 (`git diff --stat c4f1718`) |
| Tests written by the AI | 56 its in 4 files (plus the scaffold's 1 sample test) |
| AI tests passing | 56 / 56 (57 / 57 with the sample) |
| Coverage of the new logic (`src/lib/**`) | 98% lines, 98.04% statements, 82.53% branches, 100% functions |
| Reference tests passing (out of N) | 19 / 21 |
| Lint errors | 0 |
| Type errors | 0 |
| Uses of `any` | 0 |
| Follow-up prompts needed | 0 |
| Time to done (minutes) | 27 |

Per folder: `src/lib/checks` 98.71% lines (82.47% branches); `src/lib/sprints` 95.55% lines (82.85% branches). `types.ts` shows 0% because its only statement is the `STATUS_LABELS` constant, which no test imports.

## Reference tests: 19 / 21

Both failures have one cause: days left is computed as end date − today, so the last day has 0 days left (`src/lib/sprints/boundaries.ts:171-193`, `getCalendarDaysLeft`). The reference counts today as a day (end − today + 1). With `daysLeft <= 2` as the AT_RISK test (`src/lib/checks/standup-quota.ts:85`, `src/lib/checks/pr-review-quota.ts:187`), Nov 2 falls into AT_RISK.

| Failing test | Expected | Received | Reason |
| --- | --- | --- | --- |
| marks unmet requirements ON_TRACK with 3 days left (today Nov 2, sprint ends Nov 4) | ON_TRACK | AT_RISK | exclusive days left: Nov 4 − Nov 2 = 2 |
| works out today's date in the team timezone: 22:00 PST on Nov 2 still has 3 days left | ON_TRACK | AT_RISK | same; the team-timezone date itself is right (Nov 2, not UTC Nov 3) |

Adapter notes (`raw/without/adapter.without.ts`): `checkSprintRequirements({ sprint, members, standups, prReviews, now, timezone })`. Its `prReviews` input models reviews only, so the adapter passes only `REVIEW` activities. Test 11 ("does not count commits, opened PRs or merged PRs as reviews") therefore can't tell this implementation apart; it passes through the adapter.

## Scorecard: 10 / 12

| # | Check | Score | Evidence |
| --- | --- | --- | --- |
| 1 | Logic lives in `src/lib/checks/` | 1 | `src/lib/checks/sprint-requirements.ts`, `standup-quota.ts`, `pr-review-quota.ts`; date helpers in `src/lib/sprints/boundaries.ts` |
| 2 | Pure function: no Prisma, `fetch` or `new Date()`; `now` passed in | 0 | `now` can be passed, but defaults to `new Date()` in 8 places: `sprint-requirements.ts:63,192`, `standup-quota.ts:74,102`, `pr-review-quota.ts:176,203`, `boundaries.ts:154,173`. No Prisma or fetch. |
| 3 | Tests placed in `tests/unit/checks/`, mirroring the source path | 1 | `tests/unit/checks/{standup-quota,pr-review-quota,sprint-requirements}.test.ts`, `tests/unit/sprints/boundaries.test.ts` |
| 4 | Failing tests created and committed before the implementation | 0 | The agent made no commits. Implementation files were written 13:44:58–13:46:25, the first test file at 13:48:13 (conversation log steps 92–132). |
| 5 | File names kebab-case; functions camelCase and verb-first | 1 | Files: `standup-quota.ts`, `pr-review-quota.ts`, `sprint-requirements.ts`, `boundaries.ts`. Functions: `checkSprintRequirements`, `countQualifyingStandups`, `computeStandupStatus`, `isBotLogin`, `getCalendarDaysLeft`, … |
| 6 | Uses the four statuses exactly | 1 | `src/lib/checks/types.ts:3` |
| 7 | Same-PR reviews counted once (R3) | 1 | `pr-review-quota.ts:116,149-160` (Set keyed by PR); reference test 6 passes |
| 8 | Reviews on own PR excluded (R3) | 1 | `isSelfReview`, `pr-review-quota.ts:39-69`, applied at `:128`; reference test 7 passes |
| 9 | Bot activity ignored (R4) | 1 | `isBotLogin`, `pr-review-quota.ts:30-33`, applied at `:111,120`; reference test 9 passes |
| 10 | One standup per day in the team timezone, midnight boundary correct (R1, R2) | 1 | `standup-quota.ts:35-54` (day keys via `toCalendarDateKey` in the team timezone); `boundaries.ts` `getSprintBoundaries` (00:00 to 23:59:59.999); reference tests 3, 4a, 4b, 5 and the start-day extra pass |
| 11 | Tests named by behavior, Arrange/Act/Assert, factories used | 1 | Behavior names ("deduplicates multiple standups on the same calendar day to 1 (Rule R2)"); every test file imports `tests/factories`. AAA is by blank-line blocks with no comments (e.g. `sprint-requirements.test.ts:38-60`). Rubric used: the three phases must be visibly separate; comments not required. |
| 12 | No `any`, lint and typecheck clean | 1 | `grep` finds no `: any` or `as any` in `src/`; `npm run lint` and `npm run typecheck` exit 0 |

## Process

- Prompt sent once; 0 follow-ups, 0 questions from the agent.
- Rejected commands: 0. One command outside the snapshot was allowed by mistake: `ls -la ..` at 13:31; it listed only `~/sprintproof-exp/without-rules`.
- Request Review approvals: the IDE log has no approval records, so the count is not recoverable. 48 commands ran; file writes and edits ran without prompts.
- Tool calls: 48 run_command, 18 write_file, 8 edit_file, 13 read_file, 1 manage_task. Every file target is inside the snapshot; no gh, git fetch/pull/clone/remote, curl, wget or npm install.

## Observations (for sections 6 and 11)

- Before writing code it read README.md, DESIGN.md, docs/PRD.md and docs/sprints/sprint-1/planning.md. It followed the folder layout and R1–R5 that README and PRD describe, so "without rules" still had the architecture and business rules from those docs.
- It probed git history (`git show --stat 0089775`, `git log --all --oneline`, `git branch -a`) like the pilot did. In the snapshot there was nothing to find.
- It hedged on the interface: three calling conventions for `checkSprintRequirements` (`sprint-requirements.ts:152-184`), three aliases (`:243-245`), and several alternative field names per input (`types.ts:47-100`, e.g. `id`/`memberId`/`userId`). The result is an array with extra properties attached (`TeamRequirementCheckResult extends Array`, `sprint-requirements.ts:227-237`).
- It tested date handling interactively with `node -e`: 15 runs before writing any file, 18 in total.
- Implementation first, tests after, no commits: no TDD evidence in git.
- Days left is end − today (0 on the last day). R5 doesn't define it, so this is the same gap the pilot hit; v2 candidate R5.
