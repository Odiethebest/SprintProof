## User story
As someone who never knows if we're on track, I want a dashboard that updates the moment something happens, so I can see where we stand anytime.

## Acceptance criteria
- [ ] Dashboard shows the current sprint name, dates and days left
- [ ] One `MemberCard` per member with commits, PRs, reviews and standups counts, and a `RequirementChecklist` using #10
- [ ] New standups and GitHub activity trigger a Pusher event on `team-{teamId}`; the affected section refetches within 5 seconds without a page reload
- [ ] `LiveIndicator` shows "Live" or "Reconnecting…"
- [ ] Updates are announced through an `aria-live="polite"` region
- [ ] Empty state when the team has no sprint yet
- [ ] Recent activity feed (last 20 items)
- [ ] E2E test: posting a standup in one browser context updates the dashboard in another

**Estimate:** 5 points
**PRD:** US-7
**Depends on:** #9, #10, #11
