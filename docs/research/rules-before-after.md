# Rules file experiment: with vs without AGENTS.md

<!--
  HW3 Task 3 and 4 record. Raw measurements are in docs/research/raw/, screenshots in docs/research/img/.
  Ziqi ran the WITHOUT round; Yunhong ran the WITH rounds (v1 and v2). All rounds start from the same base commit.
-->

## 1. Goal

Show that our rules file (`AGENTS.md` + `CLAUDE.md`) produces measurably better AI-generated code for a real Sprint 1 feature, and use the results to improve the rules.

## 2. Feature under test

**Issue #10 — Compute requirement status per member.** Chosen because it is pure business logic with precise, checkable rules (R1–R5 in `docs/PRD.md`), so differences in correctness, structure and tests are easy to measure.

## 3. Conditions

Every round matched on everything except the rules files. Each round ran in its own snapshot of the base commit, with no git history and no remote (see Setup below).

| | Without rules | With rules (v1) | With rules (v2) |
| --- | --- | --- | --- |
| Run by | Ziqi (Odie) Yang | Yunhong Huang | Yunhong Huang |
| Date | 2026-10-29, 13:27–13:54 PDT | 2026-10-29, 12:49–about 13:50 PDT | 2026-10-29 22:54 – 2026-10-30 00:16 PDT |
| Base commit (`BASE_SHA`) | `290efc0` | `290efc0` | `290efc0` |
| Setup commit on the branch (`SETUP_SHA`) | `c4f1718` | `4240706` | `0b39bf9` |
| Rules | none (`AGENTS.md`, `CLAUDE.md` removed) | v1, as at `290efc0` | v2: the PR #28 diff (`git diff 5600c81 f75067c`) applied to `290efc0`; the same rules as `main` at `d682863` |
| Snapshot commit (`SNAP_SHA`) | `0089775` | `85b93f7` | `b141636` |
| Branch | `experiment/without-rules` | `experiment/with-rules-run2` (pilot: `experiment/with-rules`) | `experiment/with-rules-v2` |
| Tool | Antigravity desktop IDE 2.28.2, macOS | Antigravity desktop IDE 2.28.1, Windows (PowerShell) | Antigravity desktop IDE 2.28.1, Windows (PowerShell) |
| Model | Gemini 3.8 Flash High | Gemini 3.8 Flash High | Gemini 3.8 Flash High |
| Review mode | Request Review | Request Review | Request Review |
| Global/user rules in the IDE | None installed (no switch; only built-in skills) | None installed | None installed |
| Knowledge / memories | Nothing to clear (no knowledge folder) | TBD (Yunhong to confirm) | No such setting found; the pilot and run2 conversations were deleted first |
| Fresh chat | Yes | Yes | Yes |
| Hidden in the snapshot | `docs/research/`, `scripts/issues/` | `docs/research/`, `scripts/issues/` | `docs/research/`, `scripts/issues/` |

- **Does Antigravity load `AGENTS.md` from the repo root on its own?** Not determined. The WITH prompt names `AGENTS.md` explicitly, so the agent reads it either way.
- **Full conditions:** IDE permission settings and the 19-rule denylist are in [`raw/conditions.md`](raw/conditions.md).

### Setup (every round)

The pilot showed that an agent will read deleted files back out of git history (see section 11). So every round ran in a snapshot outside the repo, and the agent's commits were replayed onto a branch from `BASE_SHA` afterwards.

```bash
# Snapshot: files of BASE_SHA only, no history, no remote
mkdir -p ~/sprintproof-exp/without-rules
git -C <repo> archive 290efc0 | tar -x -C ~/sprintproof-exp/without-rules
cd ~/sprintproof-exp/without-rules
rm -rf AGENTS.md CLAUDE.md docs/research scripts/issues   # WITH rounds keep AGENTS.md and CLAUDE.md
git init -q -b experiment/without-rules
git add -A && git commit -qm "chore: snapshot of 290efc0 without rules and experiment materials (#10)"
npm ci
# v2 only: apply the v2 rules diff (PR #28) on top of the archive before git init
```

### Replay into the real repo

```bash
# In the snapshot, after the run
git format-patch <SNAP_SHA>..HEAD -o ~/sprintproof-results/patches/<round>
# In the real repo
git checkout -b experiment/<round> 290efc0
git rm -rq docs/research scripts/issues            # WITHOUT round also removes AGENTS.md and CLAUDE.md
git commit -m "chore: hide experiment materials for HW3 <round> round (#10)"   # SETUP_SHA
git am ~/sprintproof-results/patches/<round>/*.patch
git push -u origin experiment/<round>
```

`git am` keeps each commit's author, message and order, so the TDD evidence survives. SHAs differ from the snapshot because the committer date changes. The diff stats match.

## 4. Prompts (verbatim)

**Without rules:**

> Implement a function that checks whether each team member met the sprint's standup and PR review requirements. Add tests.

**With rules (v1 and v2, identical):**

> Implement issue #10, "Compute requirement status per member". Follow AGENTS.md and docs/PRD.md (US-5 and business rules R1-R5). Acceptance criteria:
> - [ ] Pure function in `src/lib/checks/` that takes a sprint, members, standups, activities and `now`, and returns, for each member and each requirement: `count`, `required`, `remaining`, `status`
> - [ ] Standups: at most one per member per day in the team timezone (R2)
> - [ ] Reviews: distinct PRs reviewed, only on PRs authored by someone else (R3)
> - [ ] Activity from bot logins (ending in `[bot]`) is ignored (R4)
> - [ ] Status follows R5 exactly: `MET`, `ON_TRACK`, `AT_RISK` (2 or fewer days left), `MISSED`
> - [ ] No I/O: no Prisma, no `fetch`, no `new Date()` inside the function
> - [ ] Unit tests cover: empty sprint; member with no activity; multiple reviews on the same PR; review on own PR; bot activity; standup at 23:59 and 00:00 on a sprint boundary; each status
> - [ ] Coverage of `src/lib/checks/` ≥ 90%
> - [ ] Failing tests committed before implementation
>
> Add tests.

### Follow-up policy (same for every round)

- **Allowed:** "continue", and pasting error output from `npm test`, `npm run lint` or `npm run typecheck`. Questions from the agent also get "continue".
- **Not allowed:** explaining requirements, pointing out bugs, or giving design hints.
- Maximum 5 follow-ups. Count every one.
- No manual edits to the generated code before measuring.
- **Request Review approvals** are counted separately from follow-ups.
- **Commands rejected and logged verbatim:** anything that touches a path outside the snapshot, plus `gh`, `git fetch` and any network call, including npm registry installs.
- **If the agent stops after the failing tests,** the experimenter commits them in the snapshot and replies "continue". If it doesn't stop, nothing is split afterwards.

## 5. Measurements

Run on each experiment branch in the real repo. Business code was not changed and nothing was committed while measuring.

```bash
git diff --stat <SETUP_SHA>               # files and lines the agent added (rules removal not counted)
git log --oneline 290efc0..HEAD           # commit order (TDD evidence)
npm run lint                              # lint errors
npm run typecheck                         # type errors
npx vitest run --coverage                 # tests, pass/fail, coverage
grep -rn ": any\|as any" src/             # uses of any
```

Then we ran our **reference tests** (written by Ziqi from R1–R5 before any round, and never visible to the agents) against each implementation. Each round got one thin adapter that maps the shared fixture input onto that implementation's signature; the tests themselves are identical.

```bash
cp -r ~/sprintproof-reference tests/reference   # edit only tests/reference/adapter.ts
npx vitest run tests/reference/
rm -rf tests/reference
```

Reference tests and adapters: [`raw/reference/`](raw/reference/), [`raw/without/adapter.without.ts`](raw/without/adapter.without.ts), [`raw/with-v1/adapter.with-v1.ts`](raw/with-v1/adapter.with-v1.ts). Full results: [`raw/without.md`](raw/without.md), [`raw/with-v1.md`](raw/with-v1.md), [`raw/with-v2.md`](raw/with-v2.md).

### Metrics

| Metric | Without | With v1 | With v2 |
| --- | --- | --- | --- |
| Files created / changed | 17 / 0 | 4 / 0 | 8 / 0 |
| Lines added | 2290 | 1138 | 891 |
| Tests written by the AI | 56 in 4 files | 16 in 1 file (12 in the `test` commit) | 19 in 1 file (all 19 in the `test` commit) |
| AI tests passing | 56 / 56 | 16 / 16 | 19 / 19 |
| Coverage of the new logic (lines / branches) | 98.71% / 82.47% (`src/lib/checks`) | 95.83% / 73.88% (`src/lib/checks`) | 94.73% / 76.19% (`src/lib/checks`) |
| Reference tests passing (out of N) | 19 / 21 | 21 / 21 | 21 / 21 |
| Lint errors | 0 | 0 | 0 (with the v2 `no-non-null-assertion` rule on) |
| Type errors | 0 | 0 | 0 |
| Uses of `any` | 0 | 0 | 0 |
| Follow-up prompts needed | 0 | 0 | 0 (plus the planned "continue" at the red checkpoint) |
| Time to done (minutes) | 27 | about 61, including approval waits | about 82, including approval waits and the wait at the red checkpoint |
| Request Review approvals | n/a (the IDE log has no approval records) | 59 | 39 |
| Rejected commands | 0 | 1 | 0 |

Both failing reference tests in the WITHOUT round have one cause. Days left is computed as end − today, so Nov 2 with a Nov 4 end has 2 days left and is `AT_RISK` (`src/lib/sprints/boundaries.ts:171-193`). The reference counts today as a day.

v2 passes 21 / 21 whether the sprint dates go in as midnight in the team timezone or as UTC midnight. Yunhong measured that on the experiment branch, and Ziqi got the same result again on the head of PR #30 (`0827fa6`) during review.

### Scorecard (1 point each)

| # | Check | Without | With v1 | With v2 |
| --- | --- | --- | --- | --- |
| 1 | Logic lives in `src/lib/checks/` | 1 | 1 | 1 |
| 2 | Pure function: no Prisma, `fetch` or `new Date()`; `now` passed in | 0 | 1 | 1 |
| 3 | Tests placed in `tests/unit/checks/`, mirroring the source path | 1 | 1 | 1 |
| 4 | Failing tests created and committed before the implementation | 0 | 1 | 1 |
| 5 | File names kebab-case; functions camelCase and verb-first | 1 | 1 | 1 |
| 6 | Uses the four statuses `MET` / `ON_TRACK` / `AT_RISK` / `MISSED` exactly | 1 | 1 | 1 |
| 7 | Same-PR reviews counted once (R3) | 1 | 1 | 1 |
| 8 | Reviews on own PR excluded (R3) | 1 | 1 | 1 |
| 9 | Bot activity ignored (R4) | 1 | 1 | 1 |
| 10 | One standup per day in the team timezone, midnight boundary correct (R1, R2) | 1 | 1 | 1 |
| 11 | Tests named by behavior, Arrange/Act/Assert, factories used | 1 | 1 | 1 |
| 12 | No `any`, lint and typecheck clean | 1 | 1 | 1 |
| | **Total (out of 12)** | **10** | **12** | **12** |

Item 11 rubric: the three phases must be visibly separate; comments are not required. Evidence for every cell is in the raw result files.

## 6. Observations

v1 and v2 each wrote their own `src/lib/checks/requirement-status.ts`. Line numbers refer to the round named in the bullet: v1 on `experiment/with-rules-run2`, v2 on `experiment/with-rules-v2` (now on `main` through PR #30).

### Code quality and consistency with project patterns

**`now` handling.**
- WITHOUT: `now` is optional and defaults to `new Date()` in 8 places (`src/lib/checks/sprint-requirements.ts:63,192`, `standup-quota.ts:74,102`, `pr-review-quota.ts:176,203`, `src/lib/sprints/boundaries.ts:154,173`).
- v1: `now: Date` is required (`src/lib/checks/requirement-status.ts:107`), and `grep` finds no `new Date` anywhere in `src/lib`.
- v2: the same. `now: Date` is required (`:55`), and every `TZDate` is built from an input date, never from the clock.

**Interface hedging.** v1 reduced it; v2 removed the kinds the v2 rule names, and one new kind appeared.
- WITHOUT:
  - three calling conventions (`sprint-requirements.ts:152-184`)
  - three aliases for the main function (`:243-245`)
  - a result that subclasses `Array` with extra properties (`:227-237`)
- v1:
  - positional and options-object calls (`requirement-status.ts:308-334`)
  - the same check exposed as `reviews`, `prReviews` and `requirements.*` (`:86-93`)
  - an array with `byMemberId`, `get` and per-member properties attached (`:96-100,459-465`)
- v2:
  - one options-object signature (`:114-116`), one name per field, and no `??` anywhere in the file
  - a plain array from `members.map` (`:131`)
  - **the new hedge:** both sprint-boundary helpers (`:59-88`) read a `Date` at exactly UTC midnight as a calendar date and any other `Date` as an instant in the team timezone. Sprint dates therefore have two accepted forms. The v2 rule names alternative field names, not alternative representations of one value.

**Rule breaks in v1.**
- **Non-null assertion:** `now = nowArg!` (`:333`), though `AGENTS.md` §1 allows `!` only in tests. Lint passed because `eslint-config-next/typescript` doesn't enable `@typescript-eslint/no-non-null-assertion`. It also hides a real failure: a positional call without `now` throws at `now.getTime()`.
- **Hard-coded fallbacks:** the team timezone, 3 standups and 5 reviews (`:336-340`). These hide a missing field instead of failing.

**No rule breaks found in v2.**
- No `!`, and lint passes with the rule on.
- `timezone`, `standupsPerPerson` and `reviewsPerPerson` are required (`:23-25`) and used directly (`:119-120,188,194`), with no defaults.

### Understanding of design and PRD intent

**Business rules in the WITHOUT round.** Even without rules, the agent read `README.md`, `DESIGN.md`, `docs/PRD.md` and `docs/sprints/sprint-1/planning.md`, and applied R1–R4 correctly. The business rules reach the agent through the PRD and README as well as through `AGENTS.md`.

**Days left decided the reference-test gap.**
- WITHOUT: end − today (`boundaries.ts:171-193`), which failed 2 tests.
- v1: end − today + 1 (`requirement-status.ts:187-188`), which matches the prototype's "2 days left" on Nov 3. It got there only after running `git grep "days left"` and opening `docs/design/02-dashboard.png`. Neither v1 rules file defines days left.
- v2: end − today + 1, citing the v2 definition from `AGENTS.md` (`:125-126`). Its tests use the same examples as the v2 wording: 3, 2 and 1 days left (`test:417,443,469`).

**Activity input.**
- v1 takes the issue's `activities` input and filters to `REVIEW` itself (`isReviewActivity`, `:231-234`, applied at `:391`).
- WITHOUT takes a `prReviews` list, so the caller must filter. Reference test 11 ("does not count commits, opened PRs or merged PRs as reviews") therefore can't tell that implementation apart.
- v2 also takes `activities` and filters to `REVIEW` itself (`:156`). It is stricter about incomplete data: a review with no `prNumber` or no `prAuthorLogin` isn't counted (`:171,175`), where v1 fell back to `activity.id` or `"unknown"`.

**Bots.** All three rounds ignore bot reviews:
- WITHOUT: `pr-review-quota.ts:30-33`
- v1: `requirement-status.ts:197-203`
- v2: `requirement-status.ts:150-152,161`

### Naming conventions and architecture

**Layout.**
- WITHOUT spread the work over 17 files following the README layout: `src/lib/checks/{standup-quota,pr-review-quota,sprint-requirements,types,index}.ts` and the date math in `src/lib/sprints/boundaries.ts`.
- v1 put everything, the date helpers included, in one 468-line file, `src/lib/checks/requirement-status.ts`, re-exported from `src/lib/checks/index.ts:1`. `AGENTS.md` §1 says sprint date math belongs in `lib/sprints/`.
- v2 did the same in a 200-line file. The boundary helpers (`:59-88`) are still there, not in `lib/sprints/`.

**Naming.**
- All three use kebab-case file names and the four statuses exactly (WITHOUT `types.ts:3`, v1 and v2 `requirement-status.ts:4`).
- All three use verb-first camelCase functions. v1's `toTZDate` (`:110`) is the only converter-style name.

**Size.** v1 is about half the size of WITHOUT (1138 vs 2290 lines added). v2 adds 891 lines; 200 of them are logic, against v1's 468-line logic file.

**Rule citations.**
- v1 cites the PRD rule IDs in comments ("Business rule R5", `:174`), not the `(AGENTS.md §1)` form that §3 suggests.
- v2 uses the `(AGENTS.md §1, R5)` form (`:58,74,90,125,132,146`).

### Quality of generated tests

**WITHOUT: no TDD evidence in git.**
- It wrote the implementation first (13:44:58–13:46:25) and the first test file after (13:48:13).
- It made no commits.
- Its 56 tests use behavior names with rule IDs, blank-line Arrange/Act/Assert blocks, and `tests/factories`.

**v1: tests first, but not all of them.**
- **Test commit:** 12 tests in `5249469` `test(checks)`, after a red run (`npm test`, exit 1).
- **Implementation commit:** `38d2aa0` `feat(checks)` added 4 more tests (+171/−5 lines). 3 of the 4 only cover the alternative input shapes.
- **Style:** all 16 tests have explicit `// Arrange`, `// Act` and `// Assert` comments and use `tests/factories/index.ts`.

**v2: all tests first.**
- **Red checkpoint:** the agent ran its 19 tests against a stub, saw all 19 fail, and ended its turn. The developer replied with the planned "continue".
- **Test commit:** `08cb96e` `test(checks)` holds all 19 tests (6 files under `tests/`, 690 lines).
- **Implementation commit:** `72f67c4` `feat(checks)` touches only `src/lib/checks/` (2 files, 201 lines). The developer made both commits; the agent never ran `git commit`.
- **Style:** all 19 tests have `// Arrange`, `// Act` and `// Assert`. Factories are split per model (`tests/factories/{activity,member,sprint,standup}.ts`), with sequences reset in `beforeEach`.
- **Gaps:** no test covers a review outside the sprint window (`:166`) or UTC-midnight sprint dates (`:61-70`, `:77-86`).

**Branch coverage was lower with rules:** 73.88% vs 82.47%. Most uncovered v1 branches are the fallback chains for alternative field names and argument forms (`requirement-status.ts:263-267,296-305,324-340`).

v2 rose to 76.19%: 32 of 42 branches, down from 134 branches in v1. That's still below the WITHOUT round. 8 of the 10 uncovered branch locations are the UTC-midnight special case (`:61-65`, `:77-81`).

## 7. Screenshots

All screenshots are in `docs/research/img/`.

| File | Shows |
| --- | --- |
| [`without-prompt.png`](img/without-prompt.png) | Prompt and first response, without rules |
| [`without-tree.png`](img/without-tree.png) | Files the AI created |
| [`without-tests.png`](img/without-tests.png) | Test and coverage output (`npm test`: 57 passed) |
| `with-prompt.png` | Prompt and first response, with rules v1 |
| `with-tree.png` | Files the AI created |
| `with-tests.png` | Test and coverage output |
| `with-commits.png` | `git log` showing the failing-test commit before implementation |
| `v2-red-checkpoint.png` | End of the v2 red-checkpoint message |
| `v2-summary.png` | The agent's final summary, v2 |

## 8. What the rules missed → changes in v2

All changes are in PR #28 (`f75067c`, merged as `d682863`). Each one has a Changelog row in `AGENTS.md`.

| Problem seen in the experiment | Rule added or changed | Changelog entry |
| --- | --- | --- |
| Both rounds hedged the interface; most uncovered v1 branches are those fallbacks | `AGENTS.md` §1 Coding standards: one options object per exported `src/lib/` function; no positional overloads, aliases, fallback field names, defaults for required fields, or properties attached to arrays | "One input shape per function in `src/lib/`" |
| v1 committed its failing tests itself and went on without stopping; 4 of its 16 tests landed in the `feat` commit. The numbered "Stop." step was only in `CLAUDE.md`, which the prompt doesn't name | `AGENTS.md` §1 Testing strategy: red checkpoint (write failing tests, show the red run, end the turn; the developer makes the `test(...)` commit; later tests get their own `test(...)` commit). §3 points to it | "Red checkpoint for AI tools" |
| WITHOUT failed 2 reference tests by using end − today; v1 got it right only after finding the mockup | `AGENTS.md` §1 Requirement status, PRD R5 and README Counting Rules: days left = end date − today in the team timezone + 1 | "Days left defined" |
| v1 put `nowArg!` in `src/` and lint passed | `eslint.config.mjs`: `@typescript-eslint/no-non-null-assertion` is an error in `src/**/*.{ts,tsx}`. This is a tooling guardrail, not a wording change | "Lint: `@typescript-eslint/no-non-null-assertion` is an error in `src/`" |
| Not from the experiment: R4 said "ignore bots" only for commits (issue #1 review) | `AGENTS.md` §1, PRD R4, README: bots ignored for every activity type | "Bots are ignored for every activity type" |
| Not from the experiment: the docs described one `standups.md` per sprint | `AGENTS.md` §3, README: one standup file per person | "Sprint records" |

## 9. Re-run with v2

Same feature, same prompt, fresh chat, `AGENTS.md` v2. Results go in the "With v2" columns above.

In S2 we wrote down, before the rerun, what each change should show:

| v2 change | Expected in the rerun | Result |
| --- | --- | --- |
| One input shape | one signature, no aliases, branch coverage ≥ 82.47% | **Partly met.** One signature and no aliases: pass (`:114-116`, `:131`). The assumed field names are listed under "Assumptions" in the red-checkpoint message, not in the final summary. Branch coverage: **fail**, 76.19% (32/42), up from v1's 73.88%. Most of the gap is the UTC-midnight special case (section 6) |
| Red checkpoint | agent stops after the red run; same test count in the `test` and `feat` commits | **Met.** The agent stopped after 19 tests failed and waited for "continue". `08cb96e` and `72f67c4` both have 19 tests, and `72f67c4` doesn't touch `tests/` |
| Days left defined | still 21 / 21 (no score change expected; see section 11) | **Met.** 21 / 21, and the definition is cited in the code (`:125`) |
| Lint guardrail | lint exit 0 with no `!` in `src/` | **Met.** Lint exit 0 with the rule on; no `!` in `src/lib/checks/` |

[`raw/with-v2.md`](raw/with-v2.md) splits these into 10 finer checks. 9 pass, and the one that fails is branch coverage.

## 10. Conclusion

With rules v1, the scorecard went from 10/12 to 12/12 and reference tests from 19/21 to 21/21, in half the code (1138 vs 2290 lines).
- **TDD in git:** the failing-test commit came first, where the WITHOUT round made no commits at all.
- **`now` passed in:** no `new Date()` defaults in `lib/`, where the WITHOUT round had 8.

The rules didn't fix everything:
- **Hedging:** both rounds hedged the interface, and v1's branch coverage was lower (73.88% vs 82.47%).
- **No stop:** v1 didn't stop after the failing tests.
- **Rule break:** v1 broke the non-null-assertion rule without lint noticing.

v2 targeted exactly these gaps, and the rerun used the identical prompt. With v2:
- **Scores held:** the scorecard stayed at 12/12 and the reference tests at 21/21.
- **Smaller:** 891 lines added, 200 of them logic (v1: a 468-line logic file).
- **One shape:** a single options-object signature, with no aliases, field-name fallbacks or defaults for required fields.
- **Stopped at red:** the agent stopped after the failing tests, and all 19 tests landed in the `test` commit.
- **Lint clean:** no `!` in `src/`, with lint now enforcing it.

What v2 didn't fix:
- **Branch coverage:** 76.19%, below the 82.47% target. Most of the gap is a hedge the v2 wording doesn't name: a second accepted form for sprint dates.
- **Candidates for v3:**
  - say how calendar dates such as sprint start and end are passed into `lib/`
  - in the manual, commit the failing tests before replying "continue"

With one run per condition, these are signals, not proof.

## 11. Limitations

**Sample and setup**
- One feature and one run per condition; results may vary between runs.
- **The prompts differ.** As the assignment specifies, the WITHOUT round gets a brief description and the WITH prompt carries #10's acceptance criteria. Two scorecard wins (no `new Date()`, failing tests committed first) are written in those criteria, so the WITHOUT → v1 difference mixes the rules file with the prompt. The v1 → v2 comparison uses the identical prompt and changes only the rules, so it isolates the rules more cleanly.
- **Different people and machines.** The rounds were run by different people, on different machines:
  - OS: macOS vs Windows with PowerShell.
  - IDE: 2.28.2 vs 2.28.1, a patch-level difference. Only the latest build was offered, so we declined updates for the rest of the experiment.

**What the agents could read**
- **Business rules in every round.** `docs/PRD.md` and README's Counting Rules are present in every round, so the WITHOUT agent still had R1–R5.
- **Known leak in `planning.md`.** `docs/sprints/sprint-1/planning.md` mentions the experiment on #10 and was readable in every round.
- `docs/research/` (the scorecard) and `scripts/issues/` (#10's source text) were hidden in every round.
- **Pilot (`experiment/with-rules`, `513486a`, kept unchanged):**
  - Run in a normal clone, the agent used `git show` to read the scorecard and #10's issue file back out of git history.
  - The official rounds therefore ran in history-free snapshots.
  - The agents still probed history in the snapshots and found nothing:
    - WITHOUT: `git log --all`, `git show --stat`.
    - v1: `git branch -a`, `git config -l`, `git log -g`.
- **Leftover IDE conversations.** Ziqi's IDE still held three old agy CLI conversation summaries, one from the real clone; they couldn't be deleted. During run2, the pilot conversation was still in Yunhong's IDE list.

**Commands**
- **Mistaken approvals and rejections:**
  - WITHOUT: none rejected. `ls -la ..` was allowed by mistake and showed only the snapshot folder.
  - v1: 1 rejected, verbatim `python -c "import PIL; print(PIL.__file__)"`. `git config -l` was allowed by mistake; its output held no experiment material.
- **Windows-only failures in v1:**
  - `npm run lint && npm run typecheck && npm test` failed under PowerShell.
  - `npm run format` touched 11 unrelated files, which the agent reverted itself. Cause unknown; line endings were ruled out, since the snapshot files are LF.

**The v2 red checkpoint**
- **"continue" came before the test commit.** By the time the developer committed the tests, the agent had already replaced the stub with the implementation. So `08cb96e` holds only the tests, and the red-state stub never reached git. The TDD order in git still holds, since the tests-only commit precedes the `feat` commit.

**Measurement**
- **Approvals and time aren't comparable.**
  - The WITHOUT round's IDE log has no approval records.
  - v1's 61 minutes include waiting on 59 approvals. v2's 82 minutes include 39 approvals and the wait at the red checkpoint.
  - Both approval counts were made by hand.
- **The WITHOUT adapter can't test filtering.** Its implementation takes reviews only, so reference test 11 can't discriminate it.

**The v2 rules were written after we saw the reference results.**
- **Days left is a spec fix, not an improvement.** The definition itself (end − today + 1) was fixed on 2026-10-28, before any round, and the reference tests use it. Writing it into the rules makes v2's days-left tests a spec fix, not evidence that the rules improved.
- **The lint rule is a tooling change.** The v2 lint rule changes tooling as well as wording.
