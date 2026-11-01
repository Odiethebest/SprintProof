# With rules v1: measurement (Y-B run2)

- BASE_SHA: 290efc0
- SETUP_SHA: 4240706 (hides docs/research/, scripts/issues/; AGENTS.md and CLAUDE.md v1 stay)
- Branch: experiment/with-rules-run2 (agent output in 5249469 `test(checks)` and 38d2aa0 `feat(checks)`, replayed with git am from snapshot commits e603b18 and 7966045, snapshot SNAP_SHA 85b93f7)
- Model: Gemini 3.8 Flash High, Antigravity desktop 2.28.1, Request Review
- Run: 2026-10-29, 12:49 to about 13:50 PDT, in the snapshot F:\sprintproof-exp\with-rules
- Measured: 2026-10-29 by Claude Code; no business code changed, nothing committed
- Raw output: appendix below; adapter saved as ~/sprintproof-results/raw-with-v1/adapter.with-v1.ts

## Metrics

| Metric | With v1 |
| --- | --- |
| Files created / changed | 4 created, 0 changed (`src/lib/checks/index.ts`, `src/lib/checks/requirement-status.ts`, `tests/factories/index.ts`, `tests/unit/checks/requirement-status.test.ts`) |
| Lines added | 1138 (`git diff --stat 4240706`) |
| Tests written by the AI | 16 its in 1 file (12 in the test commit 5249469, 16 after the feat commit 38d2aa0), plus the scaffold's 1 sample test |
| AI tests passing | 16 / 16 (17 / 17 with the sample) |
| Coverage of the new logic (`src/lib/checks/requirement-status.ts`) | 95.83% lines, 95.86% statements, 73.88% branches, 100% functions |
| Reference tests passing (out of N) | 21 / 21 |
| Lint errors | 0 |
| Type errors | 0 |
| Uses of `any` | 0 |
| Follow-up prompts needed | 0 |
| Time to done (minutes) | about 61 |

Per folder: `src/lib/checks` 95.83% lines (115/120), 95.86% statements (116/121), 73.88% branches (99/134), 100% functions (12/12). The "All files" row of `npx vitest run --coverage` (95.96% lines, 74.63% branches) also counts `tests/factories/index.ts` (4/4 lines). Uncovered statements: `requirement-status.ts:199,226,253,357,401`. Most uncovered branches are the fallback chains of alternative field names (`:263-267`, `:296-305`) and the positional/options argument handling (`:324-340`).

Branch coverage of `src/lib/checks/` (73.88%) is below the without round's (82.47%).

The package.json `test` script, the vitest config and the test framework are unchanged against 290efc0 (`git diff 290efc0 -- package.json vitest.config.mts` is empty), so `npm test` was not rerun separately.

## Reference tests: 21 / 21

No failures. Unlike the without round, days left is computed as end − today + 1 (`requirement-status.ts:187-188`, `differenceInCalendarDays(sprintEnd, nowInTeamTz) + 1`), which matches the reference definition, so tests 12b and "22:00 PST on Nov 2 still has 3 days left" pass.

Adapter notes (`raw-with-v1/adapter.with-v1.ts`): `computeRequirementStatus({ sprint: { ...sprint, timezone }, members, standups, activities, now })`, options-object form. Mappings: `submittedAt` → `createdAt` (standups), `occurredAt` → `createdAt` (activities), `githubLogin: null` → `undefined`, `now` string → `Date`; the extra `remaining`, `prReviews` and `requirements` fields are dropped from the result. **The implementation accepts every activity type and filters to `REVIEW` itself (`isReviewActivity`, `:231-234`, applied at `:391`), so all activities were passed in unchanged.** Test 11 ("does not count commits, opened PRs or merged PRs as reviews") therefore does exercise this implementation's filtering. The vitest config was unchanged, so `tests/reference/` was found without a temporary config.

## Scorecard: 12 / 12

| # | Check | Score | Evidence |
| --- | --- | --- | --- |
| 1 | Logic lives in `src/lib/checks/` | 1 | `src/lib/checks/requirement-status.ts` (468 lines), re-exported from `src/lib/checks/index.ts:1`. All logic, date helpers included, is in this one file. |
| 2 | Pure function: no Prisma, `fetch` or `new Date()`; `now` passed in | 1 | `grep -n "new Date\|prisma\|fetch(\|process.env\|from \"next"` over `src/lib` finds nothing. `now: Date` is required in `ComputeRequirementStatusParams` (`:107`); there is no default. Note: the positional form takes `nowArg?: Date` and uses `now = nowArg!` (`:313,333`), a non-null assertion outside tests, which AGENTS.md §1 allows only in tests. It doesn't affect purity. |
| 3 | Tests placed in `tests/unit/checks/`, mirroring the source path | 1 | `tests/unit/checks/requirement-status.test.ts` mirrors `src/lib/checks/requirement-status.ts`. |
| 4 | Failing tests created and committed before the implementation | 1 | `git log --oneline 290efc0..HEAD`: 5249469 `test(checks): add failing tests for requirement status (#10)` comes before 38d2aa0 `feat(checks): compute requirement status per member (#10)`. Red run before the test commit (run2 notes, allow #21: `npm test`, exit 1). **Note: the AI did not stop after committing the tests; it went straight on to the implementation. Also, the implementation commit 38d2aa0 adds about 171 lines to the test file and deletes 5 (`git show --numstat 38d2aa0`: `171 5 tests/unit/checks/requirement-status.test.ts`), raising it from 12 to 16 tests, so the test commit doesn't hold all the tests.** |
| 5 | File names kebab-case; functions camelCase and verb-first | 1 | Files: `requirement-status.ts`, `index.ts`, `requirement-status.test.ts`. Functions: `computeRequirementStatus` (`:308`), `evaluateRequirementStatus` (`:167`), `getSprintBoundaries` (`:137`), `parseDateComponents` (`:117`), `getPrIdentifier` (`:293`); booleans `isBotLogin` (`:197`), `isStandupForMember` (`:205`), `isReviewActivity` (`:231`), `isActivityForMember` (`:236`), `isOwnPrReview` (`:259`). `toTZDate` (`:110`) is the only one not strictly verb-first (a `toX` converter). |
| 6 | Uses the four statuses `MET` / `ON_TRACK` / `AT_RISK` / `MISSED` exactly | 1 | `requirement-status.ts:4` `type RequirementStatus = "MET" \| "ON_TRACK" \| "AT_RISK" \| "MISSED"`; returned at `:180,184,191,194`. |
| 7 | Same-PR reviews counted once (R3) | 1 | `distinctReviewedPrs = new Set<string>()` keyed by `getPrIdentifier` (`:381,417-418`); AI test `:97`; reference test 6 passes. Edge case: with no PR number on the activity, the key falls back to `activity.id`, then `"unknown"` (`:303-305`). |
| 8 | Reviews on own PR excluded (R3) | 1 | `isOwnPrReview` (`:259-291`), applied at `:413`; AI test `:141`; reference test 7 passes. |
| 9 | Bot activity ignored (R4) | 1 | `isBotLogin` (`:197-203`, `endsWith("[bot]")`), applied at `:387`; AI test `:177`; reference test 9 passes. Applied only to activities, not to standups (bots don't post standups). |
| 10 | One standup per day in the team timezone, midnight boundary correct (R1, R2) | 1 | Day key `format(tzDate, "yyyy-MM-dd")` on a `TZDate` in the team timezone (`:360-366`); boundaries 00:00:00.000 to 23:59:59.999 in the team timezone (`getSprintBoundaries`, `:137-165`). AI tests `:218` (both boundaries, ±1 s) and `:266`; reference tests 3, 4a, 4b, 5 and the start-day extra pass. |
| 11 | Tests named by behavior, Arrange/Act/Assert, factories used | 1 | Behavior names ("counts multiple reviews on the same PR as one distinct review (R3)", `:97`); a few are vaguer ("handles empty sprint with no standups and no activities", `:25`; "supports options object parameter structure and lookup helpers", `:425`). All 16 tests have `// Arrange`, `// Act` and `// Assert` (16 of each, e.g. `:26,30,39`). Data built with `createSprint`, `createMember`, `createStandup` and `createActivity` from `tests/factories/index.ts` (imported at `:7-12`). Rubric used: the three phases must be visibly separate; comments not required. |
| 12 | No `any`, lint and typecheck clean | 1 | `grep -rn ": any\|as any" src/` finds nothing (exit 1); `npm run lint` and `npm run typecheck` exit 0. It uses `as unknown as RequirementStatusResult` (`:342`) and a `[memberId: string]: unknown` index signature (`:99`), which aren't `any`. |

## Process

- Prompt sent once; 0 follow-ups, 0 questions from the agent.
- Request Review approvals: 59 (all "Yes, allow this time"), matching the 59 "Ran" entries in the log. One was a mistaken approval: `git config -l` at 12:57, which reads git config outside the snapshot. **The approval count is a manual count; the without round has no such data (its IDE log had no approval records), so the two can't be compared directly.**
- Rejected commands: 1. At 13:19, verbatim: `python -c "import PIL; print(PIL.__file__)"`. It would have printed an install path outside the snapshot and has nothing to do with the task.
- Did the AI stop after writing the tests? No. It ran the tests (red, exit 1), committed them itself (13:27), and went straight on to the implementation without waiting.
- Both commits were made by the AI in the snapshot; they were replayed into this branch with git am (so SHAs differ: e603b18 → 5249469, 7966045 → 38d2aa0; the diff stats match, 4 files, 1138 insertions).
- Coverage of the logic file the AI wrote: `src/lib/checks/requirement-status.ts` 95.83% lines, 95.86% statements, 73.88% branches, 100% functions.

## Observations (for sections 6 and 11)

- Before writing code it probed git history like the other rounds: check recent commits → `git branch -a` → `git config -l` → `git log -g` (reflog). The snapshot has a single commit, so there was nothing hidden to find.
- It searched the docs with `git grep` for "days left", `AT_RISK`, `RequirementStatus`, `SprintSummary`, `standupsPerPerson` and `model Membership`, and read `docs/design/02-dashboard.png` with its own tool after the PIL command was rejected. Days left = end − today + 1 matches the prototype ("2 days left" on Nov 3); this is the gap that cost the without round 2 reference tests.
- It went off-stack once (`python --version`, then PIL); everything it kept is TypeScript.
- It tried the date library interactively with `node -e` before writing tests (4 runs) and 2 more times before the implementation, then read `@date-fns/tz` type definitions with `node -e` to fix the first typecheck failure.
- It checked its own work against AGENTS.md: `git grep` for `console.log`, `new Date` in `src/lib/checks` and `prisma|fetch` (none found).
- `npm run format` touched 11 files outside #10; the agent saw this with `git diff` and reverted them with `git checkout`, so the final diff stays in `src/lib/checks/`, `tests/unit/checks/` and `tests/factories/`.
- Interface hedging is still there, as in the without round: positional and options-object calling conventions (`:308-334`); the same check exposed as `reviews`, `prReviews` and `requirements.*` (`:86-93`); a result that is an array with `byMemberId`, `get` and per-member-id properties attached (`:96-100,459-465`); and several alternative field names per input (`userId`/`memberId`/`authorId`, `createdAt`/`date`/`submittedAt`, `metadata.*`/`payload.*`, `:23-73`). Most of the uncovered branches come from these fallbacks.
- Defaults are hard-coded in `lib/`: timezone `"America/Los_Angeles"` (`:336`), 3 standups and 5 reviews (`:339-340`). They match AGENTS.md defaults but hide a missing field.
- Rule citations use the PRD rule IDs ("Business rule R1", "Counting rule R3/R4", `:141,174,201,260`), not the `(AGENTS.md §1)` form suggested in AGENTS.md §3.
- Self-reported results (17/17, 95.86% statements, 95.83% lines) match the measurement; it didn't report branch coverage.

## Appendix: raw output

### `git diff --stat 4240706`

```
 src/lib/checks/index.ts                      |   1 +
 src/lib/checks/requirement-status.ts         | 468 ++++++++++++++++++++++
 tests/factories/index.ts                     |  94 +++++
 tests/unit/checks/requirement-status.test.ts | 575 +++++++++++++++++++++++++++
 4 files changed, 1138 insertions(+)
```

### `git log --oneline 290efc0..HEAD`

```
38d2aa0 feat(checks): compute requirement status per member (#10)
5249469 test(checks): add failing tests for requirement status (#10)
4240706 chore: hide experiment materials for HW3 with-rules round (#10)
```

`git show --stat`: 5249469 = `tests/factories/index.ts` 94 + `tests/unit/checks/requirement-status.test.ts` 409 (2 files, 503 insertions). 38d2aa0 = `src/lib/checks/index.ts` 1, `src/lib/checks/requirement-status.ts` 468, `tests/unit/checks/requirement-status.test.ts` +171 −5 (3 files, 640 insertions, 5 deletions).

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
      Tests  17 passed (17)
   Start at  14:24:27
   Duration  1.72s (import 86%, transform 7%, tests 3%, worker 3%)

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-------------------|---------|----------|---------|---------|-------------------
All files          |      96 |    74.63 |     100 |   95.96 |
 src/lib/checks    |   95.86 |    73.88 |     100 |   95.83 |
  ...ent-status.ts |   95.86 |    73.88 |     100 |   95.83 | ...26,253,357,401
-------------------|---------|----------|---------|---------|-------------------

=============================== Coverage summary ===============================
Statements   : 96% ( 120/125 )
Branches     : 74.63% ( 103/138 )
Functions    : 100% ( 16/16 )
Lines        : 95.96% ( 119/124 )
================================================================================
EXIT 0
```

Per-file (json-summary): `src/lib/checks/requirement-status.ts` lines 115/120, statements 116/121, functions 12/12, branches 99/134; `tests/factories/index.ts` 4/4 in every column. Uncovered statement lines (from coverage-final.json): 199, 226, 253, 357, 401.

### `grep -rn ": any\|as any" src/`

```
(no output)
EXIT 1
```

### Test count

```
git show 5249469:tests/unit/checks/requirement-status.test.ts | grep -cE "^\s*(it|test)\("   → 12
git show 38d2aa0:tests/unit/checks/requirement-status.test.ts | grep -cE "^\s*(it|test)\("   → 16
```

Tests added in 38d2aa0: "supports options object parameter structure and lookup helpers", "ignores non-review activity and reviews outside the sprint window", "handles sprint with Date objects for start and end dates", "matches standup and activity by memberId and authorId".

### `npx vitest run tests/reference/`

```
 RUN  v5.0.5 F:/projects/SprintProof

 Test Files  1 passed (1)
      Tests  21 passed (21)
   Start at  14:25:17
   Duration  1.90s (import 93%, transform 4%, tests 3%)

EXIT 0
```
