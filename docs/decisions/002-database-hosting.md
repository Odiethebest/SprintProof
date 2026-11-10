# 002. Host the database on Supabase

**Date:** 2026-11-05 · **Status:** Accepted · **Issue:** #17
**Deciders:** Ziqi (Odie) Yang, Yunhong Huang

## Context
Local development and CI use PostgreSQL in Docker (#5, #36). Vercel needs a hosted database, and the README asks for a separate database for PR previews and for production. Both of us had used Supabase before.

## Options considered
1. **Supabase** — pros: free plan, both of us know it, Session pooler works over IPv4 / cons: a free project pauses after about a week of low activity; its auth, storage and realtime features overlap with Auth.js and Pusher, so we only use the database.
2. **Neon** — pros: database branching per preview, compute resumes on request / cons: new to both of us.
3. **One database for previews and production** — pros: one less project to manage / cons: previews could change real data; rejected.

## Decision
Two Supabase projects on the free plan, in a dedicated SprintProof organization in East US (North Virginia): sprintproof-prod for Vercel Production and sprintproof-preview for Vercel Preview. The app connects only through Prisma on the server, using the Session pooler (port 5432) for both runtime and migrations.

## Consequences
- The Supabase Data API is turned off on both projects, so no table is exposed through Supabase's REST API.
- Migrations are applied with `prisma migrate deploy` by hand after each merged migration. As of 2026-11-10, every migration through #56 is applied to both databases. #16's reached production about three hours after #64 merged, and production's Settings page failed until then; #56's reached it about six hours after #69 merged. So run `migrate status` on both databases right after a merge that adds a migration. Automating this is a follow-up.
- Connection strings live in Vercel environment variables. Whoever applies migrations keeps the two database passwords in their local, git-ignored `.env` as `SUPABASE_PROD_DB_PASSWORD` and `SUPABASE_PREVIEW_DB_PASSWORD`, next to each project's Session pooler URI as `SUPABASE_PROD_DB_URL` and `SUPABASE_PREVIEW_DB_URL`, with `[YOUR-PASSWORD]` left in. Passwords are shared between partners privately, never in the repo, PRs or docs.
- A paused project must be resumed from the Supabase dashboard; the data is kept.
- Supabase runs PostgreSQL 17.11. CI moved to 17 in #17 so the check that gates merges matches production; local Docker stays on 16. The schema uses no version-specific features.
- All PR previews share one preview database, so they can see each other's data.
- If connection limits become a problem, switch the runtime to the Transaction pooler (port 6543) and keep the Session pooler for migrations.