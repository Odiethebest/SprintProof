# 005. Each team has its own webhook secret

**Date:** 2026-11-11 · **Status:** Accepted · **Issue:** #78 (decision), #115 (fix)
**Deciders:** Ziqi (Odie) Yang; Yunhong Huang to confirm in review

## Context
`GITHUB_WEBHOOK_SECRET` is one secret for the whole server. Settings tells each lead to ask whoever deployed the app for it (`src/components/teams/repository-card.tsx`). So:
- anyone who has it, which is every lead who set up a webhook, can sign a delivery that names another team's repository and add commits or reviews to that team's counts;
- rotating it breaks every team's webhook at once.

AGENTS.md §2 Settings already describes a masked per-team secret with "Rotate secret".

## Options considered
1. **A secret per team, checked after the repository lookup:** pros: a lead can only sign deliveries for their own team, one team can rotate without affecting others, matches the Settings design / cons: a migration, a Settings control, and the route has to read the payload's repository before it can verify the signature.
2. **Keep one secret and document "one deployment per class":** pros: no change / cons: the forgery stays possible inside a class, which is exactly the setting where counts matter.

## Decision
Option 1. Each team gets a random secret when it's created (existing teams get one in the migration). The webhook route reads the repository from the raw payload, finds the team, and verifies `X-Hub-Signature-256` with that team's secret using `timingSafeEqual`. The lead sees it masked in Settings, with "Copy" and "Rotate secret".

## Consequences
- Until a team's own secret is set on GitHub, deliveries signed with the server-wide `GITHUB_WEBHOOK_SECRET` are still accepted, so connected repositories keep working through the change. The PR for #115 documents when that fallback can be removed.
- Reading the repository before verifying means an unsigned payload is parsed once before it's rejected. Nothing is stored or trusted before the signature check.
- Decision 007 builds on this: the team whose secret signed a `ping` is the team the repository belongs to.
