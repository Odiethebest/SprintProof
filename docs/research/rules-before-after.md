# Rules file experiment: with vs without AGENTS.md

<!--
  HW3 Task 3 and 4 record. Fill in as you go; keep screenshots in docs/research/img/.
  Ziqi runs the WITHOUT round, Yunhong runs the WITH round, both from the same base commit.
-->

## 1. Goal

Show that our rules file (`AGENTS.md` + `CLAUDE.md`) produces measurably better AI-generated code for a real Sprint 1 feature, and use the results to improve the rules.

## 2. Feature under test

**Issue #10 — Compute requirement status per member.** Chosen because it is pure business logic with precise, checkable rules (R1–R5 in `docs/PRD.md`), so differences in correctness, structure and tests are easy to measure.

## 3. Conditions

Both rounds must match on everything except the rules file.

| | Without rules | With rules (v1) | With rules (v2) |
| --- | --- | --- | --- |
| Run by | Ziqi (Odie) Yang | Yunhong Huang | Yunhong Huang |
| Date | | | |
| Base commit (`git rev-parse --short HEAD`) | | | |
| Branch | `experiment/without-rules` | `experiment/with-rules` | `experiment/with-rules-v2` |
| Tool | Antigravity | Antigravity | Antigravity |
| Model | | | |
| `AGENTS.md` / `CLAUDE.md` present | No (deleted on branch) | Yes, v1 | Yes, v2 |
| Global/user rules in the IDE | Disabled | Disabled | Disabled |
| Fresh chat | Yes | Yes | Yes |

### Setup for the WITHOUT round

```bash
git checkout main && git pull
git checkout -b experiment/without-rules
git rm AGENTS.md CLAUDE.md && git commit -m "chore: remove rules for HW3 baseline (#10)"
```

Then check the IDE settings: no global rules, no workspace rules, no memory carried over.

### Setup for the WITH round

```bash
git checkout main && git pull
git checkout -b experiment/with-rules
```

## 4. Prompts (verbatim)

**Without rules:**

> Implement a function that checks whether each team member met the sprint's standup and PR review requirements. Add tests.

**With rules:**

> Implement issue #10, "Compute requirement status per member". Follow AGENTS.md and docs/PRD.md (US-5 and business rules R1–R5). Acceptance criteria:
> *(paste the acceptance criteria checklist from issue #10)*
> Add tests.

### Follow-up policy (same for both rounds)

- Allowed: "continue", and pasting error output from `npm test`, `npm run lint` or `npm run typecheck`.
- Not allowed: explaining requirements, pointing out bugs, or giving design hints.
- Maximum 5 follow-ups. Count every one.
- No manual edits to the generated code before measuring.

## 5. Measurements

Run on each branch after the AI says it's done:

```bash
git diff --stat main                      # files and lines changed
git log --oneline main..HEAD              # commit order (TDD evidence)
npm run lint 2>&1 | tail -n 5             # lint errors
npm run typecheck 2>&1 | tail -n 5        # type errors
npx vitest run --coverage                 # tests, pass/fail, coverage
grep -rn ": any\|as any" src/ || true     # uses of any
```

Then run our **reference tests** (written by us, not the AI) against each implementation to check correctness:

```bash
npx vitest run tests/reference/requirement-status.reference.test.ts
```

<!-- Write the reference tests BEFORE either round, from rules R1–R5, so neither AI sees them.
     If the AI's function signature differs, add a thin adapter in the reference test. -->

### Metrics

| Metric | Without | With v1 | With v2 |
| --- | --- | --- | --- |
| Files created / changed | | | |
| Lines added | | | |
| Tests written by the AI | | | |
| AI tests passing | | | |
| Coverage of the new logic | | | |
| Reference tests passing (out of N) | | | |
| Lint errors | | | |
| Type errors | | | |
| Uses of `any` | | | |
| Follow-up prompts needed | | | |
| Time to done (minutes) | | | |

### Scorecard (1 point each)

| # | Check | Without | With v1 | With v2 |
| --- | --- | --- | --- | --- |
| 1 | Logic lives in `src/lib/checks/` | | | |
| 2 | Pure function: no Prisma, `fetch` or `new Date()`; `now` passed in | | | |
| 3 | Tests placed in `tests/unit/checks/`, mirroring the source path | | | |
| 4 | Failing tests created and committed before the implementation | | | |
| 5 | File names kebab-case; functions camelCase and verb-first | | | |
| 6 | Uses the four statuses `MET` / `ON_TRACK` / `AT_RISK` / `MISSED` exactly | | | |
| 7 | Same-PR reviews counted once (R3) | | | |
| 8 | Reviews on own PR excluded (R3) | | | |
| 9 | Bot activity ignored (R4) | | | |
| 10 | One standup per day in the team timezone, midnight boundary correct (R1, R2) | | | |
| 11 | Tests named by behavior, Arrange/Act/Assert, factories used | | | |
| 12 | No `any`, lint and typecheck clean | | | |
| | **Total (out of 12)** | | | |

## 6. Observations

### Code quality and consistency with project patterns

### Understanding of design and PRD intent

### Naming conventions and architecture

### Quality of generated tests

## 7. Screenshots

Save in `docs/research/img/` and link here.

| File | Shows |
| --- | --- |
| `without-prompt.png` | Prompt and first response, without rules |
| `without-tree.png` | Files the AI created |
| `without-tests.png` | Test and coverage output |
| `with-prompt.png` | Prompt and first response, with rules |
| `with-tree.png` | Files the AI created |
| `with-tests.png` | Test and coverage output |
| `with-commits.png` | `git log` showing the failing-test commit before implementation |

## 8. What the rules missed → changes in v2

| Problem seen in the WITH round | Rule added or changed in `AGENTS.md` | Changelog entry |
| --- | --- | --- |
| | | |

## 9. Re-run with v2

Same feature, same prompt, fresh chat, `AGENTS.md` v2. Record results in the "With v2" columns above and summarize what improved.

## 10. Conclusion

<!-- 3–5 sentences with the numbers: e.g. "Scorecard went from 4/12 to 10/12 (11/12 with v2); reference tests 9/16 → 16/16." -->

## 11. Limitations

- One feature and one run per condition; results may vary between runs.
- The WITH prompt also contains the issue's acceptance criteria, which is part of what the rules file asks for; the WITHOUT round gets only a brief description, as the assignment specifies.
- The two rounds were run by different people.
