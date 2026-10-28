@AGENTS.md

# Claude Code notes

All shared project rules (stack, architecture, conventions, testing, workflow) live in `AGENTS.md`, imported above. Do not duplicate them here. This file only adds instructions specific to Claude Code.

## Start of every session

- Work on exactly one GitHub issue per session. Ask for the issue number if it isn't given, and read the issue's acceptance criteria before doing anything.
- For UI work, read `DESIGN.md` and the relevant section of `docs/PRD.md` first.
- For any change touching more than two files, propose a short plan and wait for approval before editing.

## TDD, step by step

1. Write the failing test(s) for the acceptance criteria.
2. Run them and show the failure output.
3. **Stop.** The failing tests get their own `test(...)` commit: the developer makes it, or explicitly asks you to.
4. Only then write the implementation, run the tests again, and show them passing.

Never write implementation and tests in the same step, and never weaken or delete a test to make it pass.

## Commands

- Single test file: `npx vitest run path/to/file.test.ts`
- All unit tests: `npm test`
- Integration tests: `npm run test:integration`
- E2E: `npm run test:e2e`
- Before saying a task is done: `npm run lint && npm run typecheck && npm test`

## Boundaries

- **Run `git commit` or `git push` only when the developer explicitly asks.** Each approval covers that request only, not later commits. Commit under the developer's own git identity (never change `user.name` or `user.email`), follow the commit format in `AGENTS.md`, and show what is staged before committing. This project measures contribution balance from git history, so every commit must belong to the developer who asked for it.
- **Never merge PRs, force-push, or push directly to `main`.** Merging needs the partner's approving review.
- Do not read or edit `.env`, `.env.local` or any real secret file. Only `.env.example` may be edited, and it holds names only.
- Do not run destructive database commands (`prisma migrate reset`, dropping tables) without explicit permission.
- Do not add a new dependency without asking first and saying why.

## Scoped rules and skills

- Folder-specific rules and reusable skills go in `.claude/` (for example `.claude/skills/`). Keep them narrow; anything that applies to every tool belongs in `AGENTS.md`.

## End of every session

- Summarize what changed, which acceptance criteria are met, and what's left, in a form that can be pasted into the PR description.
- If you learned a convention that should apply to every tool, suggest an edit to `AGENTS.md` rather than adding it here.
