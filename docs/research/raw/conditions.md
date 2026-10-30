# HW3 rules experiment: conditions (Ziqi)

Agreed at S1 on 2026-10-29.

- BASE_SHA: 290efc0 (Merge pull request #24 from Odiethebest/fix/3-starter-page)
- Model: Gemini 3.8 Flash High (Antigravity)
- Review mode: Request Review, all rounds
- Setup: every round runs in a snapshot outside the repo (git archive 290efc0, hidden files removed, git init with one commit, no remote).
  Afterwards the agent's commits are replayed with git format-patch / git am onto a branch from 290efc0 in the real repo.
- Hidden in every round: docs/research/, scripts/issues/. Without-rules round also removes AGENTS.md and CLAUDE.md.
- Replies to the agent: only "continue" or pasted error output, at most 5. Request Review approvals are counted separately.
- Commands touching paths outside the snapshot, gh, git fetch or any network call are rejected and logged.
- Antigravity Knowledge / memories cleared before each round.

## Antigravity settings, as named in the app (Ziqi, without-rules round)

- Harness: Antigravity desktop IDE 2.28.2 (Yunhong: 2.28.1, a patch-level difference; only the latest build was offered). Switched from the agy CLI before the run so both rounds use the IDE.
- Auto-update: no switch under Settings → Application; rule for both rounds: decline update prompts and do not restart the IDE until the experiment ends
- Permission Preset (global): Request Review
- Old conversations: the IDE's summary store holds three agy CLI sessions (one opened in the real clone; its summary has that path and the repo name). The IDE lists no conversations for the project and offers no way to delete them. Left in place; the denylist covers both the path and github.com.
- Project: "CLI Project" (shared with agy), folder ~/sprintproof-exp/without-rules, Permission Preset and Plan Review Policy = Inherit Global
- Plan Review Policy (global): Always Ask (Yunhong to confirm run2's value)
- Project permission denylist (`~/.gemini/config/projects/default-cli-project.json`, shown in the IDE under Settings → CLI Project → Permission Settings as File Access Rules 14 and Network Access Rules 5; 19 rules):
  read_file and write_file on: the real clone, ~/sprintproof-results, ~/sprintproof-reference.zip, ~/.claude,
  ~/Desktop/SprintProof-HW3-执行手册.pdf, /private/tmp/claude-501, /tmp/claude-501;
  read_url on: github.com, api.github.com, raw.githubusercontent.com, codeload.github.com, objects.githubusercontent.com
- Global permission rules: empty
- Terminal commands: not covered by the denylist; every command asks first (Request Review). Rejected by hand and logged: anything touching paths outside the snapshot, gh, git fetch/pull/clone/remote, curl/wget, and all other network use, including npm installs from the registry (agreed with Yunhong 2026-10-29)
- Global rules: none installed; there's no on/off switch (Customizations → Installed: 0 plugins, 0 custom agents, 0 MCP servers, 9 Built In skills & rules; no ~/AGENTS.md, ~/GEMINI.md, ~/.gemini/GEMINI.md or ~/.gemini/rules)
- Workspace rules: none (the snapshot has no AGENTS.md or CLAUDE.md)
- Terminal command execution: no separate setting seen; every command asks first under Permission Preset = Request Review
- Access to files outside the workspace: no such setting seen; limited by the project File Access Rules (14 read_file/write_file deny rules)
- Browser / URL tools: no browser setting seen; URL reads limited by the project Network Access Rules (5 read_url deny rules); global Network Access Rules empty
- Knowledge / memories: nothing to clear. At 13:13 ~/.gemini/antigravity had no knowledge folder, and brain/ and conversations/ were empty (the 3 old agy summaries above aside)

## Does Antigravity load AGENTS.md from the repo root on its own?

Not determined (Yunhong to confirm). The WITH prompt names AGENTS.md explicitly, so the agent reads it either way.
