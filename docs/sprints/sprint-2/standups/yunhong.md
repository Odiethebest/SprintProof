# Sprint 2 standups — Yunhong Huang

<!--
  At least 3 entries per sprint (P2 requirement). Add each entry on the day it happens
  so the commit history matches the dates. Newest entry at the top.
  This file is edited only by Yunhong Huang, so it never conflicts with the partner's file.
-->
### 2026-11-07
**Yesterday:** Merged main into my sprints PR (#47) and fixed Ziqi's review notes test-first; it's merged. Reviewed Ziqi's fixes on my webhook PR (#49): checked the TDD order, read the fix commits and ran 234 unit and 133 integration tests locally; it's merged. Applied the #11 migration to both Supabase databases and reset the production database password. Reviewed the standup PR (#51) and flagged that a page left open past midnight saves under the new day.
**Today:** Review #52 and #54. Open a follow-up issue for sprint date edits that leave standups outside their sprint (from #8). Start the rest of #17: CodeQL, npm audit and an E2E stage in CI.
**Blockers:** None.
### 2026-11-06
**Yesterday:** Set up the Supabase preview and production databases and applied the #5, #6 and #7 migrations to both; wrote decision record 002 (#46). Opened #47 for #8 (sprint API, repository and the Settings sprints card) and reviewed #44 and #45. Wrote the failing tests for #11.
**Today:** Opened the #11 PR (GitHub webhooks: signature check, event mapping, delivery dedup, repoId). Next: address Ziqi's review on #47 (Zod body validation, requireTeamRole, the missing background token).
**Blockers:** Need to agree with Ziqi on 404 vs 403 for people outside a team. #11 and #47 both change the Settings page, so whichever merges second needs main merged in.

### 2026-11-05
**Yesterday:** Opened #40 with the sprint validation logic for #8 (merged), added my feedback to the Sprint 1 retro (#39) and reviewed the Sprint 2 plan (#42).
**Today:** Set up the Supabase preview and production databases for #17 and applied the migrations to both; reviewed #44 (#7). Next: decision record 002, then the rest of #8.
**Blockers:** None.
