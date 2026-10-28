## User story
As a team member, I want our commits, PRs and reviews recorded automatically, so nobody types activity in by hand.

## Acceptance criteria
- [ ] `POST /api/webhooks/github` verifies `X-Hub-Signature-256` (HMAC-SHA256 over the raw body, `timingSafeEqual`) and returns 401 on mismatch
- [ ] `ping` events return 200
- [ ] Handles `push`, `pull_request` (opened; closed with `merged: true`) and `pull_request_review` (submitted)
- [ ] Payloads are mapped to `Activity` records by pure functions in `src/lib/github/`
- [ ] Duplicate deliveries (same `X-GitHub-Delivery`) are stored once
- [ ] Activity from GitHub logins that aren't team members is stored but excluded from counts
- [ ] Settings page shows the webhook URL and setup steps for the lead
- [ ] Unit tests for the mappers with fixture payloads in `tests/fixtures/github/`; integration tests for signature, idempotency and each event type

**Estimate:** 5 points
**PRD:** US-6, rule R4
**Depends on:** #7
