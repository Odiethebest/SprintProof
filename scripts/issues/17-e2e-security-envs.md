## Summary
Complete the advanced CI/CD requirements: full E2E suite, security scanning, and separate environments.

## Acceptance criteria
- [ ] Playwright E2E tests for the five user flows in `AGENTS.md` §2, each with an `@axe-core/playwright` check (no serious or critical violations)
- [ ] CI pipeline stages: lint + typecheck → unit → integration (with a Postgres service container) → E2E → build; production deploy only after all pass
- [ ] CodeQL code scanning workflow enabled
- [ ] `npm audit --audit-level=high` runs in CI and fails on findings
- [ ] Dependency review action runs on PRs
- [ ] Preview and production use separate databases and environment variables, documented in the README
- [ ] CI asserts `E2E_TEST_AUTH` is not set for production

**Estimate:** 5 points
**PRD:** §8 Non-functional requirements
**Depends on:** #4, #12
