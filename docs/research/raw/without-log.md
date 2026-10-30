# Z-E without-rules run log

- Snapshot: ~/sprintproof-exp/without-rules
- SNAP_SHA: 0089775
- Start time: 13:27:56 (prompt sent; from the conversation log)
- End time: 13:54:41 (agent's final message); about 27 minutes

## Follow-ups ("continue" or pasted error, max 5)

None. The conversation has a single user message (the prompt).

## Request Review approvals

Count: taken from the conversation log afterwards

- 13:30 `git log -n 5 --oneline` (inside the snapshot): allowed once
- 13:31 `ls -la ..` (lists ~/sprintproof-exp, outside the snapshot): allowed by mistake; it should have been rejected. Output showed only the without-rules folder, so nothing leaked.
- 13:34 `node -e` requiring @date-fns/tz and date-fns from the snapshot's node_modules: allowed once
- 13:34–13:35 two more `node -e` date checks with TZDate / differenceInCalendarDays: allowed
- 13:35 `git show --stat 0089775`, then `git log --all --oneline` (inside the snapshot): allowed once

## Rejected commands

None. One command outside the snapshot (`ls -la ..`, 13:31) was allowed by mistake; see above.

## Did the agent commit on its own?

No. It left 17 new, untracked files (2290 lines) under src/lib/ and tests/.

## Observations

- Before writing code the agent read docs/PRD.md (L1-150, L148-189) and docs/sprints/sprint-1/planning.md (L1-39). PRD is present in every round by design; planning.md mentions the HW3 experiment on #10 (known leak, for section 11).
- 13:35 The agent inspected git history (`git show --stat 0089775`, `git log --all --oneline`), like the pilot did. In the snapshot there is only the one setup commit and no remote, so it found nothing.

## Totals from the conversation log

- Conversation: ~/.gemini/antigravity/brain/9429373a-d4ed-414d-8be6-7b3d7bb8fdf5 (title "Sprint Requirements Validation Function")
- Tool calls: 48 run_command, 18 write_file, 8 edit_file, 13 read_file, 1 manage_task
- The log has no explicit approval records, so the exact number of Request Review approvals is not recoverable. File writes and edits ran without a prompt (0–1 s); commands showed prompts.
- Every read, write and edit target is inside the snapshot. No gh, git fetch/pull/clone/remote, curl, wget or npm install.
- Agent's own summary: lint 0 errors, typecheck 0 errors, 57 tests in 5 files pass, ≥98% statement and line coverage.
- Without rules, it still used the layout the README and PRD describe (src/lib/checks, src/lib/sprints, tests/unit, tests/factories).
- Screenshots: img/without-prompt.png, img/without-tree.png, img/without-tests.png (npm test: 57 passed)

## Branch

- Snapshot: 0089775 (setup) → 4f64e58 "experiment: without-rules output (#10)" (all agent changes, committed by hand)
- Real repo: experiment/without-rules = 290efc0 → c4f1718 (SETUP_SHA, removes AGENTS.md, CLAUDE.md, docs/research, scripts/issues: 20 files) → cc2ef1f (git am of the snapshot commit)
- Tree of cc2ef1f equals the snapshot's HEAD tree (5b00b9f). Pushed to origin 2026-10-29.
