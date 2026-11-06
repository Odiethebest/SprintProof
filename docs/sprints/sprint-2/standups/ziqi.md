# Sprint 2 standups — Ziqi (Odie) Yang

<!--
  At least 3 entries per sprint (P2 requirement). Add each entry on the day it happens
  so the commit history matches the dates. Newest entry at the top.
  This file is edited only by Ziqi (Odie) Yang, so it never conflicts with the partner's file.
-->

### 2026-11-06
**Yesterday:** Planned Sprint 2 with Yunhong: committed 30 points to fit our capacity, rescoped #17 and moved the E2E flows into #43 (#42). Built team creation and invite links (#7: API, pages, unit, integration and E2E tests) and merged it after Yunhong's review (#44). Synced `AGENTS.md` and the README with the new code (#45). Reviewed Yunhong's database hosting record (#46, approved) and her sprints PR (#47, changes requested).
**Today:** Pushed the three fixes from my #47 review to her branch, failing tests first: Zod schemas for the sprint request bodies, `requireTeamRole()` in the sprint routes, and a defined token for the current sprint row. Next: start the standup logic for #9, and create the GitHub OAuth Apps and Vercel env vars so sign-in works on previews and production.
**Blockers:** The #9 page needs #8 merged to find the current sprint, so I'll start with the logic on fixtures.
