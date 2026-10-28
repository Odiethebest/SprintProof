## Summary
Set up the first version of the CI/CD pipeline: tests on every PR, preview deploys, automatic production deploys.

## Acceptance criteria
- [ ] `.github/workflows/ci.yml` runs on every pull request and every push to `main`
- [ ] Stages run in order: install (with npm cache) → lint + typecheck → unit tests → build
- [ ] A failing stage fails the PR check
- [ ] `main` branch rule requires the CI check to pass before merge
- [ ] Vercel project connected: every PR gets a preview URL, merges to `main` deploy to production
- [ ] CI badge in `README.md` shows the real status

**Estimate:** 3 points
**PRD:** §8 Non-functional requirements
**Depends on:** #3
**Note:** E2E, security scanning and environment separation are added in #17.
