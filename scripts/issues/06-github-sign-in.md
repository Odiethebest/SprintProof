## User story
As someone tired of new accounts, I want to sign in with GitHub, so my activity shows up without creating another login.

## Acceptance criteria
- [ ] Sign-in page with a single "Sign in with GitHub" button (Auth.js, GitHub provider, JWT sessions)
- [ ] First sign-in creates a `User` with GitHub id, login, name and avatar URL; later sign-ins update them
- [ ] Signed-out visitors to `/teams/*` and `/review/*` are redirected to `/signin`
- [ ] Sign out works from the user menu
- [ ] `requireTeamRole(teamId, roles)` returns 401 when signed out and 403 for the wrong role, with unit tests
- [ ] Test-only credentials provider enabled only when `E2E_TEST_AUTH=true`
- [ ] `docs/decisions/001-github-oauth-scopes.md` records which scopes we request and why

**Estimate:** 3 points
**PRD:** US-1
**Depends on:** #5
