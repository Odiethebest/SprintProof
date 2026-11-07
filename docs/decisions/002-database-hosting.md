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
- Migrations are applied with `prisma migrate deploy` by hand after each merged migration. As of 2026-11-07, #5, #6, #7 and #11 are applied to both databases. Automating this is a follow-up.
- Connection strings and passwords live only in Vercel environment variables and are shared between partners privately, never in the repo, PRs or docs.
- A paused project must be resumed from the Supabase dashboard; the data is kept.
- Supabase runs PostgreSQL 17.11, while the README, local Docker and CI use 16. The schema uses no version-specific features; moving Docker and CI to 17 would close the gap.
- All PR previews share one preview database, so they can see each other's data.
- If connection limits become a problem, switch the runtime to the Transaction pooler (port 6543) and keep the Session pooler for migrations.