# 007. A repository connection counts only after a verified ping

**Date:** 2026-11-11 · **Status:** Accepted · **Issue:** #78 (decision), #117 (fix)
**Deciders:** Ziqi (Odie) Yang; Yunhong Huang to confirm in review

## Context
Anyone signed in can create a team for any repository (`src/server/repositories/teams.ts`). The first claim wins: the real team then gets 409 `REPO_ALREADY_CONNECTED`, and that repository's deliveries go to the other team.

## Options considered
1. **Count a connection only after a verified `ping`:** only repository admins can add a webhook, and GitHub sends a `ping` when one is added. If the ping is signed with the team's own secret (decision 005), whoever set it up controls the repository / cons: a connection is pending until the webhook is added, and two teams can have the same repository pending.
2. **Check repository access through the GitHub API when the team is created:** pros: immediate / cons: needs an OAuth scope we deliberately don't request (decision 001), and access can change later.
3. **Keep first-claim-wins and document it:** pros: no change / cons: a team can be locked out of its own repository.

## Decision
Option 1. A team's repository is pending until GitHub delivers a `ping` signed with that team's webhook secret. That ping verifies the team and stores the repository id. Pending claims don't block anyone. Once a team is verified, no other team can claim the repository, and the database enforces at most one verified team per repository regardless of letter case. Activity is stored only for the verified team.

## Consequences
- Depends on decision 005 (#115): the per-team secret is how the ping proves which team set up the webhook.
- Teams that already received a verified delivery count as verified in the migration, so connected repositories keep working.
- Settings shows "Waiting for GitHub's ping" until the ping arrives, then "Connected".
- PRD US-2 and US-6, AGENTS.md §2 Settings and the README change in the PR for #117.
