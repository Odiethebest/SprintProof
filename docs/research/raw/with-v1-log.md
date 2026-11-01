# HW3 Y-B run2 notes (with rules v1, official round)

## Setup
- Date: 2026-10-29
- BASE_SHA: 290efc0
- Snapshot: F:\sprintproof-exp\with-rules, SNAP_SHA 85b93f7 (Antigravity project "with-rules")
- Real-clone branch: experiment/with-rules-run2, SETUP_SHA 4240706 (pushed)
- Model: Gemini 3.8 Flash High; mode: Request Review; Antigravity desktop IDE 2.28.1 (not updated)
- Approvals: always "Yes, allow this time"

## SHA mapping (git am changes the committer date, so SHAs differ)
| Content | Snapshot SHA | Real-clone SHA |
|---|---|---|
| Failing-test commit: test(checks): add failing tests for requirement status (#10) | e603b18 | 5249469 |
| Implementation commit: feat(checks): compute requirement status per member (#10) | 7966045 | 38d2aa0 |

Diff stats match on both sides: 4 files changed, 1138 insertions(+)
(src/lib/checks/index.ts 1, src/lib/checks/requirement-status.ts 468, tests/factories/index.ts 94, tests/unit/checks/requirement-status.test.ts 575)

## Summary
| Metric | Value |
|---|---|
| Start / end | 12:49 / ~13:50 |
| Duration | ~61 min (includes waiting on approval prompts; a gap between 13:03 and 13:19 included an 82 s "Thought") |
| Approvals ("allow this time") | 59 (matches the 59 "Ran" entries in the agent log; 1 approved by mistake: git config -l) |
| Skipped commands | 1 |
| "continue" follow-ups | 0 |
| Did the agent stop after writing tests? | No (committed the failing tests itself, then went straight on to the implementation) |

## Rejected (skipped) commands, verbatim
1. 13:19 `python -c "import PIL; print(PIL.__file__)"` — prints an install path outside the snapshot; unrelated to the task

## Deviations from the protocol
1. 12:57 `git config -l` approved by mistake — reads the global/system git config outside the snapshot. Output: <TODO: check>. Assessment: contains no rubric, reference tests, or #10 acceptance-criteria source text.

## Approval log
The first 4 approvals were not recorded verbatim during the run (agent log labels: check git status, check recent commits, list directory contents, run vitest unit tests). The verbatim command for #13 is still to be filled in.

| # | Time | Command |
|---|---|---|
| – | 12:49–12:50 | check git status (verbatim not recorded) |
| – | 12:49–12:50 | check recent commits (verbatim not recorded) |
| – | 12:49–12:50 | list directory contents (verbatim not recorded) |
| 1 | 12:50 | `Get-ChildItem -Recurse -File src, tests` |
| – | 12:50–12:57 | run vitest unit tests (verbatim not recorded) |
| 2 | 12:57 | `git branch -a` |
| 3 | 12:57 | `git config -l` (approved by mistake) |
| 4 | 12:58 | `git log -g` |
| 5 | 12:59 | `Get-ChildItem -Recurse src` |
| 6 | 12:59 | `Get-ChildItem docs, scripts` |
| 7 | 12:59 | `Get-ChildItem -Recurse docs/sprints` |
| 8 | 13:00 | `git grep -i "days left"` |
| 9 | 13:00 | `git grep -n -C 5 "days left" README.md DESIGN.md` |
| 10 | 13:00 | `Get-ChildItem docs/design` |
| 11 | 13:01 | `git grep -i "AT_RISK"` |
| 12 | 13:02 | `git grep -i "RequirementStatus"` |
| 13 | 13:02–13:03 | search for SprintSummary (verbatim TODO) |
| 14 | 13:03 | `git grep -i "standupsPerPerson"` |
| 15 | 13:03 | `git grep -i "model Membership"` (exit 1, not found) |
| 16 | 13:19 | `python --version` |
| 17 | 13:20 | `node -e` trying TZDate |
| 18 | 13:21 | `node -e` trying TZDate + differenceInCalendarDays |
| 19 | 13:21 | `node -e` trying a sprint boundary helper |
| 20 | 13:22 | `node -e` trying format with TZDate |
| 21 | 13:24 | `npm test` (Red, exit 1) |
| 22 | 13:25 | `git status` |
| 23 | 13:26 | `git add tests/` |
| 24 | 13:27 | `git diff --cached --stat` |
| 25 | 13:27 | `git commit -m "test(checks): add failing tests for requirement status (#10)"` |
| 26 | 13:27 | `node -e` trying a daysLeft calculation |
| 27 | 13:28 | `node -e` trying date-parts extraction |
| 28 | 13:30 | `npm test` (Green) |
| 29 | 13:31 | `npx vitest run tests/unit --coverage` |
| 30 | 13:32 | `npx vitest run tests/unit --coverage` |
| 31 | 13:33 | `git grep "console.log" src tests` (exit 1) |
| 32 | 13:33 | `git grep "new Date" src/lib/checks` (exit 1) |
| 33 | 13:34 | `git grep -E "prisma\|fetch" src/lib/checks` (exit 1) |
| 34 | 13:34 | `npm run typecheck` (exit 1) |
| 35 | 13:35 | `node -e` reading node_modules/@date-fns/tz/index.d.ts |
| 36 | 13:35 | `node -e` reading node_modules/@date-fns/tz/date/index.d.ts |
| 37 | 13:36 | `node -e` reading the next part of the same file |
| 38 | 13:37 | `npm run typecheck` |
| 39 | 13:38 | `npm run lint` (exit 1) |
| 40 | 13:39 | `npm run lint` |
| 41 | 13:40 | `npm run typecheck` |
| 42 | 13:40 | `npm test` |
| 43 | 13:41 | `npx vitest run tests/unit --coverage` |
| 44 | 13:41 | `npm run format` |
| 45 | 13:42 | `npm run lint && npm run typecheck && npm test` (exit 1; cause TBD, possibly PowerShell not supporting &&) |
| 46 | 13:43 | `npm run lint; npm run typecheck; npm test` |
| 47 | 13:44 | `git status` |
| 48 | 13:44 | `git diff .prettierrc package.json tsconfig.json` |
| 49 | 13:45 | `git checkout -- .prettierrc e2e/ eslint.config.mjs next.config.ts package-lock.json package.json playwright.config.ts src/app/ tests/unit/sample.test.ts tsconfig.json vitest.config.mts` |
| 50 | 13:46 | `git status` |
| 51 | 13:46 | `git add src/lib/checks tests/unit/checks/requirement-status.test.ts` |
| 52 | 13:47 | `git diff --cached --stat` |
| 53 | 13:48 | `git commit -m "feat(checks): compute requirement status per member (#10)"` |
| 54 | 13:49 | `git log -n 3` |
| 55 | 13:49 | `npm run lint; npm run typecheck; npm test; npx vitest run tests/unit --coverage` |

## Observations (facts only)
1. TDD order: the failing-test commit (409 lines of tests + 94 lines in tests/factories/index.ts) comes before the implementation commit; the agent made both commits itself. It did not stop for confirmation after committing the tests.
2. In the implementation commit the test file gained ~171 lines and lost 5 (409 → 575). The agent log shows an "Edited requirement-status.test.ts" right after "check test coverage", so tests were likely added after looking at coverage. Number of added test cases to be checked during measurement.
3. Early on the agent actively inspected git history: check recent commits → git branch -a → git config -l → git log -g (reflog). The snapshot has a single commit, so there were no hidden materials to find.
4. Off-stack tooling: ran python --version and tried PIL; after PIL was skipped, it used its own tool to view docs/design/02-dashboard.png (inside the snapshot).
5. Before writing tests, it experimented with the date libraries via node -e (#17–#20).
6. Self-check against acceptance criteria: searched for console.log, new Date and prisma|fetch; none found.
7. Self-correction: after the first typecheck failed it read the @date-fns/tz type definitions and fixed the code; after the first lint failure it edited the test file.
8. npm run format touched 11 files/directories unrelated to #10; the agent noticed via git diff and restored them with git checkout. Final changes are limited to src/lib/checks/, tests/unit/checks/ and tests/factories/.
9. Agent self-report: 17/17 tests passing, 95.86% statement coverage, 95.83% line coverage; branch coverage not reported (measurement results take precedence).
10. The agent's summary says the function supports both positional arguments and an options object (the pilot showed the same behavior).
11. Possible contamination path (unverified): when run2 started, the pilot conversation was still in the IDE's conversation list (under the SprintProof project). The searches for RequirementStatus / SprintSummary / standupsPerPerson did not exit 1, suggesting these names exist in the snapshot files; to be confirmed with git grep -l.

## TODO
- [ ] Output of git config -l
- [ ] Verbatim command for #13
- [ ] Cause of the #45 failure (open its output)
- [ ] Why coverage was run twice in a row (#29 and #30)
