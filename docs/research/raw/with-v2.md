# With rules v2: measurement (Y-D)

- BASE_SHA: 290efc0
- V2_SETUP_SHA: 0b39bf9 (on top of 290efc0: applies the v2 rules, i.e. `git diff 5600c81 f75067c` on AGENTS.md, README.md, docs/PRD.md and eslint.config.mjs, and hides docs/research/ and scripts/issues/). Checked: the setup commit's changes to those 4 files are line-for-line the same as `git diff 5600c81 f75067c`.
- v2 rules source: PR #28 (merged to main as d682863)
- Branch: experiment/with-rules-v2 (agent output in 08cb96e `test(checks)` and 72f67c4 `feat(checks)`, replayed with git am from the snapshot)
- Model: Gemini 3.8 Flash High, Antigravity desktop 2.28.1, Request Review
- Run: 2026-10-29 22:54 to 2026-10-30 00:16 PDT
- Measured: 2026-10-30 by Claude Code; no business code changed, nothing committed
- Raw output: appendix below; adapter saved as ~/sprintproof-results/raw-with-v2/adapter.with-v2.ts
- Agent conversation: ~/sprintproof-results/v2-agent-log.txt (red-checkpoint message at lines 22–97, final summary at 101–127); screenshots in ~/sprintproof-results/img/

## Metrics

| Metric | With v2 | With v1 (for reference) |
| --- | --- | --- |
| Files created / changed | 8 created, 0 changed | 4 created, 0 changed |
| Lines added | 891 (`git diff --stat 0b39bf9`) | 1138 |
| Tests written by the AI | 19 its in 1 file (19 in the test commit 08cb96e, 19 after the feat commit 72f67c4), plus the scaffold's 1 sample test | 16 (12 in the test commit) |
| AI tests passing | 19 / 19 (20 / 20 with the sample) | 16 / 16 |
| Coverage of the new logic (`src/lib/checks/requirement-status.ts`) | 94.73% lines, 94.82% statements, **76.19% branches**, 100% functions | 95.83% / 95.86% / 73.88% / 100% |
| Reference tests passing (out of N) | 21 / 21 | 21 / 21 |
| Lint errors | 0 (with the v2 `no-non-null-assertion` rule active) | 0 |
| Type errors | 0 | 0 |
| Uses of `any` | 0 | 0 |
| Non-null assertions in `src/lib/checks/` | 0 | 1 |
| Follow-up prompts needed | 0 (plus 1 planned "continue" at the red checkpoint) | 0 |
| Time to done (minutes) | about 82 | about 61 |

Files created: `src/lib/checks/index.ts` (1), `src/lib/checks/requirement-status.ts` (200), `tests/factories/{activity,member,sprint,standup}.ts` (20/16/15/17), `tests/factories/index.ts` (4), `tests/unit/checks/requirement-status.test.ts` (618).

Per folder: `src/lib/checks` 94.73% lines (54/57), 94.82% statements (55/58), 76.19% branches (32/42), 100% functions (6/6). The "All files" row (95.77% lines, 77.08% branches) also counts `tests/factories/` (100% lines, 83.33% branches; `sprint.ts:5`, the `overrides.timezone ??` fallback, is the one uncovered branch). Uncovered statements in `requirement-status.ts`: 67, 83, 167. Uncovered branches: `:61-65` and `:77-81` (the UTC-midnight special case in the two boundary helpers, 8 of the 10 uncovered branch locations) and `:166` (review outside the sprint window).

The package.json `test` script, the vitest config and the ESLint config are unchanged against 0b39bf9 (`git diff 0b39bf9 HEAD -- package.json package-lock.json vitest.config.mts eslint.config.mjs` is empty), so `npm test` was not rerun separately.

## Reference tests: 21 / 21

No failures. The test file was copied from `/f/sprintproof-reference/` and checked with `diff` before the run (identical; SHA-256 `19facfdf…5e92eeea26` for both).

Adapter notes (`raw-with-v2/adapter.with-v2.ts`): `computeRequirementStatus({ sprint, members, standups, activities, now })`, the implementation's only signature. Mappings: sprint `startDate`/`endDate` (`YYYY-MM-DD`) → `TZDate` at midnight in the team timezone, as the AI's own `tests/factories/sprint.ts` builds them; `timeZone` → `sprint.timezone`; member `id` → `userId`; standup `memberId` → `userId`, `submittedAt` → `createdAt` (a `Date`); activity `githubLogin` → `actorLogin`, `occurredAt` → `createdAt`; generated `id`s for sprint, standups and activities (required by the types, not used in counting); result `userId` → `memberId`; the extra `remaining` field is dropped. **The implementation accepts every activity type and filters to `REVIEW` itself (`requirement-status.ts:156`), so all activities were passed in unchanged.** The vitest config was unchanged, so `tests/reference/` was found without a temporary config.

Sensitivity check (not part of the score): passing the sprint dates as UTC midnight (`new Date("2026-10-29")`) instead also gives 21 / 21. The boundary helpers' special case (`:61-70`, `:77-86`) handles that form; the AI's own tests never use it.

## Scorecard: 12 / 12

| # | Check | Score | Evidence |
| --- | --- | --- | --- |
| 1 | Logic lives in `src/lib/checks/` | 1 | `src/lib/checks/requirement-status.ts` (200 lines), re-exported from `src/lib/checks/index.ts:1`. The sprint boundary helpers (`:59-88`) are also in this file, not in `lib/sprints/` (same as v1). |
| 2 | Pure function: no Prisma, `fetch` or `new Date()`; `now` passed in | 1 | `grep -n "new Date\|prisma\|fetch(\|process.env\|from \"next"` over `src/lib` finds nothing. `now: Date` is required in `ComputeRequirementStatusOptions` (`:55`) and used at `:122-123`; every `TZDate` is built from an input date, never from the clock. |
| 3 | Tests placed in `tests/unit/checks/`, mirroring the source path | 1 | `tests/unit/checks/requirement-status.test.ts` mirrors `src/lib/checks/requirement-status.ts`. |
| 4 | Failing tests created and committed before the implementation | 1 | `git log --oneline 290efc0..HEAD`: 08cb96e `test(checks): add failing tests for requirement status (#10)` (00:11:51) before 72f67c4 `feat(checks): compute requirement status per member (#10)` (00:18:45). The test commit holds only `tests/` (6 files, 690 lines); the feat commit only `src/lib/checks/` (2 files, 201 lines) and doesn't touch the tests. Both commits were made by the developer; the agent never ran `git commit`. |
| 5 | File names kebab-case; functions camelCase and verb-first | 1 | Files: `requirement-status.ts`, `index.ts`, `tests/factories/{activity,member,sprint,standup}.ts`. Functions: `getSprintStartBoundary` (`:59`), `getSprintEndBoundary` (`:75`), `computeRequirementProgress` (`:91`), `computeRequirementStatus` (`:114`); factories `createSprint`, `createMember`, `createStandup`, `createActivity`, `reset*Seq`. Booleans: `isSprintEnded` (`:122`), `isReviewerBot` (`:150`). |
| 6 | Uses the four statuses `MET` / `ON_TRACK` / `AT_RISK` / `MISSED` exactly | 1 | `requirement-status.ts:4`; returned at `:100,104,108,111`. |
| 7 | Same-PR reviews counted once (R3) | 1 | `reviewedPrs = new Set<number>()` keyed by `prNumber` (`:153,175-177`); AI test "counts three reviews on the same PR as one" (`test:107`); reference test 6 passes. A review with no `prNumber` isn't counted (`:175`). |
| 8 | Reviews on own PR excluded (R3) | 1 | `authorLogin === reviewerLogin` → skip (`:170-173`); AI test `test:148`; reference test 7 passes. A review with no `prAuthorLogin` is also skipped (`:171`). |
| 9 | Bot activity ignored (R4) | 1 | Bot member skipped (`:150-152`) and bot actor skipped (`:161`); AI test "ignores activity from bot logins ending in [bot]" (`test:174`); reference test 9 passes. |
| 10 | One standup per day in the team timezone, midnight boundary correct (R1, R2) | 1 | Day key from a `TZDate` in the team timezone (`:139-141`), only inside `[sprintStart, sprintEnd]` (`:138`); boundaries via `startOfDay` / `endOfDay` on `TZDate` (`:59-88`). AI tests `test:212,241,270,299` (23:59 before start, 00:00 on start, 23:59 on end, 00:00 after end), `test:328` (same day) and `test:356` (across midnight); reference tests 3, 4a, 4b, 5 and the start-day extra pass. |
| 11 | Tests named by behavior, Arrange/Act/Assert, factories used | 1 | Behavior names ("excludes standup submitted at 00:00 the day after sprint end", `test:299`); a few are vaguer ("handles an empty sprint with no standups and no activities", `test:23`). All 19 tests have `// Arrange`, `// Act` and `// Assert` (19 of each, e.g. `test:24,35,44`), most with a one-line scenario after `Arrange:`. Data built with `createSprint`, `createMember`, `createStandup`, `createActivity` (imported at `test:4-12`, sequences reset in `beforeEach` at `test:17`). Rubric used: the three phases must be visibly separate; comments not required. |
| 12 | No `any`, lint and typecheck clean | 1 | `grep -rn ": any\|as any" src/` finds nothing (exit 1); `npm run lint` and `npm run typecheck` exit 0. No casts at all in `requirement-status.ts`. |

## Rerun checks (v2 change list in sprintproof-s2.md)

| v2 change | Rerun check | Result | Evidence |
| --- | --- | --- | --- |
| 1. One input shape per function | One signature | **Pass** | `computeRequirementStatus(options: ComputeRequirementStatusOptions)` (`:114-116`) is the only export that computes; no overloads, no positional form. |
| | No aliases | **Pass** | Result is `{ userId, standups, reviews }` per member (`:13-17`), a plain array from `members.map` (`:131`); nothing attached to it. Inputs have one name per field (`:19-56`), no fallback chains (the file has no `??` at all), and no defaults for `timezone`, `standupsPerPerson`, `reviewsPerPerson` (required at `:23-25`, used directly at `:119-120,188,194`). `remaining` (`:9`) is an extra derived value, not a second name. |
| | Branch coverage ≥ 82.47% (the without round) | **Fail** | 76.19% (32/42) for `src/lib/checks/`. It rose from v1's 73.88%, and the total branch count fell from 134 to 42. 8 of the 10 uncovered branch locations are the UTC-midnight special case in the two boundary helpers (`:61-65,77-81`), which none of the AI's tests reach; the other is `:166` (review outside the sprint window; untested by the AI, but reference "does not count a review submitted before the sprint starts" passes). |
| | "Assumptions" listed for unnamed fields | **Pass** | `v2-agent-log.txt:26-42`, inside the red-checkpoint message (`:22-97`), before any implementation: "Assumptions … Options object shape: `{ sprint, members, standups, activities, now }`", then `Sprint`, `Member`, `Standup`, `Activity`, `now` and the return shape. Each matches the code exactly: `requirement-status.ts:19-26` (Sprint), `:28-31` (Member), `:33-37` (Standup), `:39-48` (Activity), `:50-56` (options), `:6-17` (result). Note: the rule says "in your summary"; the section is in the red-checkpoint message, and the final summary (`v2-agent-log.txt:101-127`) doesn't repeat it. |
| 2. Red checkpoint | Agent stops after the red run | **Pass** | It stopped on its own after 19 tests failed against a stub (`v2-agent-log.txt:71-93`: "19 tests \| 19 failed"; `:97`: "Stopping here for the red checkpoint so the developer can make the `test(checks): …` commit before implementation proceeds."), and waited; the developer replied "continue" (`:99`, the planned checkpoint). Screenshot: `img/v2-red-checkpoint.png` (end of that message, taskbar clock 0:06). |
| | Same test count in `test` and `feat` commits | **Pass** | 19 in 08cb96e and 19 in 72f67c4; 72f67c4 doesn't touch `tests/` (`git show --stat 72f67c4`). |
| 3. Define days left | Reference tests still 21/21 | **Pass** | 21 / 21. |
| | Definition cited in the code | **Pass** | `requirement-status.ts:125`: `// Days left = sprint end date minus today's date in team timezone + 1 (AGENTS.md §1, R5)`, then `differenceInCalendarDays(endDayInTz, todayInTz) + 1` (`:126`). AI tests cover 3, 2 and 1 days left (`test:417,443,469`), the same examples as the v2 wording. |
| 4. Lint guardrail | Lint exit 0 | **Pass** | `npm run lint` exit 0 with `@typescript-eslint/no-non-null-assertion: "error"` on `src/**` (from the setup commit). |
| | No `!` in `src/` | **Pass** | `grep -rn "[a-zA-Z)]!" src/lib/checks/` finds nothing (exit 1); lint would fail otherwise. |

Summary: 9 of 10 checks pass. The one failure is the branch coverage target: the hedging the v2 rule names (overloads, aliases, field-name fallbacks, defaults) is gone, but a different kind of hedge, a second accepted representation of a calendar date, accounts for most of the uncovered branches.

## Process

- Prompt sent once; 0 follow-ups, 0 questions from the agent. One planned "continue" after the red checkpoint, logged separately from follow-ups.
- Request Review approvals: 39. **This is a manual count. The without round has no such data, so the counts can't be compared directly; v1 was 59, also counted by hand.**
- Rejected commands: 0.
- Did the AI stop after writing the tests? **Yes.** At 00:05 it ran the 19 tests against a stub, all failed, and it ended its turn.
- Sequence around the checkpoint: the "continue" was sent before the test commit. By 00:10 the agent had already overwritten the stub with the implementation, so the test commit 08cb96e (00:11:51) holds only the 6 files under `tests/` (their red-run version, unchanged after 23:28); the red version of the stub was never committed. The developer made the test commit by hand; the agent never ran `git commit` at any point. The feat commit 72f67c4 (00:18:45) is also the developer's.
- Time: about 82 minutes (22:54–00:16), including approval waits and the wait at the checkpoint.
- Coverage of the logic file the AI wrote: `src/lib/checks/requirement-status.ts` 94.73% lines, 94.82% statements, 76.19% branches, 100% functions.

## Observations (for sections 6 and 11)

- **Smaller and single-shaped.** 200 lines of logic (v1: 468), one options-object signature, one name per field, no fallbacks, no hard-coded timezone or requirement defaults. The v1 hedging patterns are gone.
- **A new kind of hedge.** `getSprintStartBoundary` and `getSprintEndBoundary` (`:59-72`, `:75-88`) are the same function apart from `startOfDay` / `endOfDay`, and both carry a special case: a `Date` at exactly UTC midnight whose team-timezone date differs is read as a UTC calendar date. That supports a second way of passing sprint dates (UTC midnight, as a Postgres `date` column comes back) next to the one the AI's own factory uses (team-timezone midnight). The v2 rule names field-name fallbacks, not representation fallbacks. This branch is the main reason the coverage target was missed. Possible v3 item: say how calendar dates such as sprint start/end are passed into `lib/`.
- **Stricter about incomplete data.** A review without `prNumber` (`:175`) or without `prAuthorLogin` (`:171`) isn't counted; v1 fell back to `activity.id` or `"unknown"`.
- **Rule citations now use the AGENTS.md form**: `(AGENTS.md §1, R1)`, `(AGENTS.md §1, R5)` etc. at `:58,74,90,125,132,146`; v1 wrote "Business rule R5".
- **Factories split per model** (`tests/factories/{sprint,member,standup,activity}.ts`) with sequence counters reset in `beforeEach`; v1 used one file.
- **Test gaps** visible in coverage: no AI test for a review outside the sprint window (`:166`) or for UTC-midnight sprint dates (`:61-70`, `:77-86`).
- `member.githubLogin` bot check (`:150`) duplicates the actor check (`:161`), since only activities whose actor equals the member's login are counted.
- The checkpoint worked, but the "continue" came before the developer had committed the tests, and the agent moved fast enough that the red-state stub never reached git. For the TDD evidence this doesn't matter (the test commit is tests-only and precedes the feat commit), but the manual step order should be "commit, then continue".

## Appendix: raw output

### `git diff --stat 0b39bf9`

```
 src/lib/checks/index.ts                      |   1 +
 src/lib/checks/requirement-status.ts         | 200 +++++++++
 tests/factories/activity.ts                  |  20 +
 tests/factories/index.ts                     |   4 +
 tests/factories/member.ts                    |  16 +
 tests/factories/sprint.ts                    |  15 +
 tests/factories/standup.ts                   |  17 +
 tests/unit/checks/requirement-status.test.ts | 618 +++++++++++++++++++++++++++
 8 files changed, 891 insertions(+)
```

### `git log --oneline 290efc0..HEAD`

```
72f67c4 feat(checks): compute requirement status per member (#10)
08cb96e test(checks): add failing tests for requirement status (#10)
0b39bf9 chore: apply v2 rules and hide experiment materials for HW3 v2 round (#10)
```

`git show --stat`: 08cb96e (Fri Oct 30 00:11:51 2026 -0700) = `tests/factories/{activity,index,member,sprint,standup}.ts` and `tests/unit/checks/requirement-status.test.ts`, 6 files, 690 insertions. 72f67c4 (Fri Oct 30 00:18:45 2026 -0700) = `src/lib/checks/index.ts` 1, `src/lib/checks/requirement-status.ts` 200, 2 files, 201 insertions.

### `npm run lint`

```
> sprintproof@0.1.0 lint
> eslint .

EXIT 0
```

### `npm run typecheck`

```
> sprintproof@0.1.0 typecheck
> tsc --noEmit

EXIT 0
```

### `npx vitest run --coverage`

```
 RUN  v5.0.5 F:/projects/SprintProof
      Coverage enabled with v8

 Test Files  2 passed (2)
      Tests  20 passed (20)
   Start at  00:21:35
   Duration  1.94s (import 83%, transform 9%, tests 5%, worker 3%)

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |   95.83 |    77.08 |     100 |   95.77 |
 src/lib/checks    |   94.82 |    76.19 |     100 |   94.73 |
  ...ent-status.ts |   94.82 |    76.19 |     100 |   94.73 | 67,83,167
 tests/factories   |     100 |    83.33 |     100 |     100 |
  sprint.ts        |     100 |    66.66 |     100 |     100 | 5
-------------------|---------|----------|---------|---------|-------------------

=============================== Coverage summary ===============================
Statements   : 95.83% ( 69/72 )
Branches     : 77.08% ( 37/48 )
Functions    : 100% ( 13/13 )
Lines        : 95.77% ( 68/71 )
================================================================================
EXIT 0
```

Per-file (json-summary): `src/lib/checks/requirement-status.ts` lines 54/57, statements 55/58, functions 6/6, branches 32/42. Uncovered branch locations (coverage-final.json): lines 61, 63, 64, 65, 77, 79, 80, 81, 166.

### `grep -rn ": any\|as any" src/`

```
(no output)
EXIT 1
```

### `grep -rn "[a-zA-Z)]!" src/lib/checks/`

```
(no output)
EXIT 1
```

### Test count

```
git show 08cb96e:tests/unit/checks/requirement-status.test.ts | grep -cE "^\s*(it|test)\("   → 19
git show 72f67c4:tests/unit/checks/requirement-status.test.ts | grep -cE "^\s*(it|test)\("   → 19
```

### Reference file check

```
diff /f/sprintproof-reference/requirement-status.reference.test.ts tests/reference/requirement-status.reference.test.ts
→ (no output) test file identical
sha256: 19facfdfbaacccbdc3b0e1cbf905408388ea5da6d07b091cfff21b5e92eeea26 (both)
```

### `npx vitest run tests/reference/`

```
 RUN  v5.0.5 F:/projects/SprintProof

 Test Files  1 passed (1)
      Tests  21 passed (21)
   Start at  00:22:23
   Duration  1.76s (import 93%, transform 4%, tests 3%)

EXIT 0
```

Sensitivity run with UTC-midnight sprint dates (adapter restored afterwards): `Tests 21 passed (21)`.
