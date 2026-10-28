## User story
As someone who forgets standups, I want a quick three-question check-in that files itself under the right sprint, so the record builds on its own.

## Acceptance criteria
- [ ] `StandupForm` with Yesterday (required), Today (required), Blockers (optional), 1000 characters max each
- [ ] Submitting files the standup under the current sprint automatically
- [ ] Submitting again on the same day (team timezone) updates the existing standup instead of creating a new one (rule R2)
- [ ] If there is no current sprint, the form explains why and is disabled
- [ ] Team standups listed grouped by day, newest first
- [ ] Validation errors are shown next to the field and announced to screen readers
- [ ] Integration tests for create, same-day update, no-sprint case, and non-member 403

**Estimate:** 3 points
**PRD:** US-4, rule R2
**Depends on:** #8
