# 001. GitHub OAuth scopes

**Date:** 2026-11-01 · **Status:** Accepted · **Issue:** #6
**Deciders:** Ziqi (Odie) Yang, Yunhong Huang

## Context

Sign-in with GitHub (#6) needs four fields from the user's GitHub profile: id, login, name and avatar URL. The sign-in page already tells users exactly that: "SprintProof uses your GitHub id, login, name and avatar so your commits, PRs and reviews show up under your name." The numeric id is the stable key, and the login maps webhook activity to members.

Repository activity (commits, PRs, reviews) arrives through a repository webhook that the team lead adds in GitHub (#11). GitHub signs each delivery with our webhook secret. Webhooks work for private repositories and need no OAuth scope from anyone.

Constraints:

- `AGENTS.md` §4 asks for the minimum scopes needed, and PRD §12 left this choice open.
- OAuth app scopes are coarse. There is no read-only scope for private repositories, and no scope can be limited to one repository. `repo` grants full access to every public and private repository the user can reach, including organization resources.
- The webhook handler runs with no user present. A user's token could only be used there if we stored it, and OAuth app tokens are long-lived: GitHub revokes one only after a year without use.
- Instructors sign in through the same flow, so they see the same consent screen as students.
- Email notifications are out of scope (PRD §11), so we have no use for email addresses.
- The Auth.js GitHub provider requests `read:user user:email` by default.

## Options considered

1. **No scope (public data only).** The token can read public information only. `GET /user` then returns the public profile, which has all four fields we need.
   Pros: the smallest grant GitHub offers; the consent screen asks for nothing private; a leaked token exposes nothing that isn't already public.
   Cons: we have to override the Auth.js default. We get no email address, which we don't use. Auth.js still calls `GET /user/emails` when the public profile has no email; that call fails and Auth.js ignores the failure.
2. **`read:user user:email` (the Auth.js default).** Pros: works without configuration. Cons: reads private profile data and every email address on the account, none of which we use.
3. **`repo`.** Pros: could read a private repository's PR commit lists and create the webhook through the API. Cons: read and write access to every repository each member and instructor can reach. To use it in the webhook handler we would have to store long-lived tokens, so one leak would expose write access to every member's private repositories. Far more than counting needs.
4. **A GitHub App instead of an OAuth app.** Pros: read-only permissions on the selected repositories only; installation tokens expire after an hour and work without a user present; one built-in webhook replaces the manual setup. Cons: app registration, a private key to manage, an installation flow that links each installation to a team, and a different Settings screen from `docs/design/06-settings.png` (webhook URL, secret, setup steps). Too much for what's left of Sprint 1, with #5 to #9 still to do in order.

## Decision

Sign-in requests no OAuth scopes. We override the Auth.js default with an empty `scope`, so the token can read public data only. SprintProof never reads repositories with a user's token: repository activity comes only from webhooks (#11). We don't store the access token.

## Consequences

- Students and instructors see a consent screen that asks for public data only, and the sentence on the sign-in page stays accurate.
- `User` (#5) stores GitHub id, login, name and avatar URL, refreshed at each sign-in. It has no email column.
- The access token isn't copied into the session JWT or written to the database, so there's nothing to leak, rotate or revoke.
- #6 includes a test that the GitHub provider requests an empty scope, so a config change or library upgrade can't widen it unnoticed.
- When checking sign-in by hand, use a GitHub account that hasn't authorized the app before, or revoke the app first under GitHub Settings → Applications. GitHub skips the consent screen for an earlier grant, so you wouldn't see what a new user sees.
- **R4 needs a follow-up in #11.** The `pull_request` webhook payload doesn't include the PR's commits, and reading them from the API for a private repository needs `repo` or a GitHub App. Under this decision, #11 counts commits from `push` events instead. Those fire for pushes to any branch and carry up to 2048 commits each, so commits on a feature branch are recorded when they're pushed, before a merge or squash can hide them. Two cases are missed: PRs from forks, and commits pushed before the webhook was connected. #11 should reword R4 to match in `docs/PRD.md`, `AGENTS.md` §1 and the README together, since all three use the same wording.
- Creating the webhook automatically (the stretch goal in PRD §12) would need `write:repo_hook` from the lead. We don't request it; the lead follows the setup steps in Settings.
- Revisit with a new record (option 4) if teams need commits from fork PRs counted, or if we want to drop the manual webhook setup.
