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

## How #117 implemented it
- **Schema.** `teams.repo_verified_at` is null while the repository is pending and set by the ping that verifies the team, which also stores `repo_id`. The migration (`20261112110000_add_team_repo_verified_at`) drops both unique indexes on the name, the case-sensitive `teams_repo_full_name_key` that Prisma's `@unique` made (#7) and #94's `teams_repo_full_name_lower_key`, since two pending teams can have the same name. `@unique` is gone from `repoFullName` in the Prisma schema, so schema and database agree. In their place, `teams_verified_repo_full_name_lower_key` is a unique index on `lower(repo_full_name) WHERE repo_verified_at IS NOT NULL`: at most one verified team per repository, ignoring case. Prisma can't express it, so it's raw SQL in the migration, and `prisma migrate diff` leaves it alone. Dropping a unique index can't fail, and the new index can't either: before the migration only one team could have a name.
- **Teams already connected.** The migration sets `repo_verified_at` for every team with a stored delivery (only a delivery with a valid signature is stored with a team) or a `repo_id` (only such a delivery ever stored one), to its first delivery's time or to the migration's time. Production's only team has deliveries, so it comes out verified. Teams with neither stay pending.
- **Creating a team** (`createTeamWithLead()`) returns 409 `REPO_ALREADY_CONNECTED` only when a verified team has the name, ignoring case. A new team is pending and has no `repo_id`, so no unique index can reject it.
- **The webhook route** finds the verified team for the repository (by `repo_id`, then by name) and the pending teams (by name). The verified team's secret and the server-wide fallback work as in decision 005. If neither signed the body, each pending team's secret is checked with `timingSafeEqual`, all of them (`findSigningTeamId()` in `src/lib/github/webhook-signature.ts`). A `ping` signed with one verifies that team (`verifyTeamRepo()`), which also ends the server-wide fallback for it. A pending team's ping gets 409 `REPO_ALREADY_CONNECTED` once another team is verified, by name or by `repo_id` (a renamed repository); its other deliveries aren't stored: 404 while no team is verified (the message says to redeliver the ping), 409 after.
- **The server-wide secret never verifies a pending team.** Every lead from before #115 has it, so it can't show who added the webhook. A delivery it signs for a repository no team is verified for is handled as for a repository no team has: a ping is kept without a team, other events get 404.
- **Races.** Creating a team and verifying one take the same `REPO_CLAIM_LOCK` for the lowercased name, so a claim made after a verification sees it. A verification that gets past the lock is caught by the partial unique index (or `repo_id`'s) and answered with 409.
- **Names match ignoring case, and nothing else.** Prisma runs `equals` with `mode: "insensitive"` as `ILIKE` without escaping, so `_` (allowed in GitHub names) and `%` matched other names: `owner/a_b` was refused while `owner/aXb` was connected, and a ping naming `%/%` verified a pending team for a repository it never claimed. `teams.ts` now escapes both before comparing.
- **Settings** shows "Waiting for GitHub's ping" with one line on what the ping does, then "Connected", each with an icon. The note that the server-wide secret still works appears only once the team is connected.
- **Known limit.** A ping signed with the team's secret proves that the sender knows the secret, and the team's lead does: Settings shows it so they can paste it into GitHub. A lead who creates a team for someone else's repository can sign a ping for it themselves (GitHub's repository ids are public), and their team is then verified. This change stops accidental claims, such as a typo or the wrong repository, and a pending claim no longer locks the real team out. It doesn't stop someone who forges the ping on purpose. Closing that needs a check GitHub vouches for: the delivery's source address against the `hooks` ranges GitHub publishes at `https://api.github.com/meta` (only an admin of the repository can make GitHub send a ping naming it), or option 2's API check. That's a new decision.
