# Sprint 2 standups — Ziqi (Odie) Yang

<!--
  At least 3 entries per sprint (P2 requirement). Add each entry on the day it happens
  so the commit history matches the dates. Newest entry at the top.
  This file is edited only by Ziqi (Odie) Yang, so it never conflicts with the partner's file.
-->

### 2026-11-09
**Yesterday:** Finished #12: the sprint dashboard with member counts and the activity feed (#58) and live updates through Pusher (#60), both merged. Fixed the primary button hover color, which was below 4.5:1 contrast (#63). Reviewed and merged Yunhong's CodeQL and audit PR (#59), and finished her E2E stage (#61) by running the live update specs against a Soketi container. Opened #64 for #16: create and revoke personal API tokens in Settings; only a SHA-256 hash is stored.
**Today:** Finished #16. API tokens now read three endpoints (sprints, sprint summary, standups) with cursor pagination; every `/api/v1` endpoint is in `docs/api/openapi.yaml`, shown with Swagger UI at `/api-docs`. Merged after Yunhong's review (#64, #66). #65 merged into the stacked branch instead of `main`, so #66 carried the same commits. Closed #12 by hand. Next: the Sprint 2 retro on Nov 11, and #56 (sprint date edits that leave standups outside their sprint).
**Blockers:** None.

### 2026-11-07
**Yesterday:** Finished #9: standup logic, the standups API route and page, with unit, integration and E2E tests; merged after Yunhong's review (#51). Reviewed Yunhong's webhook PR (#49), pushed fixes for my review points to her branch (failing tests first), and merged it. Approved and merged her sprints PR (#47) and her Nov 6 standup (#50).
**Today:** Set up hosting: a production GitHub OAuth App and Vercel env vars for Production and Preview (previews sign in through production with the Auth.js redirect proxy), and applied the #11 migration to both Supabase databases. Production sign-in works again. Found that the app connected to Supabase without TLS; the connection is encrypted now, and #53 tracks certificate verification. Recorded it all in #52. Next: #12 dashboard.
**Blockers:** None.

### 2026-11-06
**Yesterday:** Planned Sprint 2 with Yunhong: committed 30 points to fit our capacity, rescoped #17 and moved the E2E flows into #43 (#42). Built team creation and invite links (#7: API, pages, unit, integration and E2E tests) and merged it after Yunhong's review (#44). Synced `AGENTS.md` and the README with the new code (#45). Reviewed Yunhong's database hosting record (#46, approved) and her sprints PR (#47, changes requested).
**Today:** Pushed the three fixes from my #47 review to her branch, failing tests first: Zod schemas for the sprint request bodies, `requireTeamRole()` in the sprint routes, and a defined token for the current sprint row. Next: start the standup logic for #9, and create the GitHub OAuth Apps and Vercel env vars so sign-in works on previews and production.
**Blockers:** The #9 page needs #8 merged to find the current sprint, so I'll start with the logic on fixtures.
