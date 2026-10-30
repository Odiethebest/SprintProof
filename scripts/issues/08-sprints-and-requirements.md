## User story
As a team lead, I want to create sprints with dates and the course's requirements, so the checks match our syllabus.

## Acceptance criteria
- [ ] Lead can create a sprint with name, start date, end date, standups per person (default 3), PR reviews per person (default 5)
- [ ] End date must be on or after start date; sprints in the same team cannot overlap (400 with a clear error)
- [ ] Non-leads get 403 when creating or editing sprints
- [ ] Sprint list visible to all members; current sprint highlighted
- [ ] `src/lib/sprints/` exports pure helpers `getCurrentSprint(sprints, now, timeZone)` and `isWithinSprint(sprint, instant, timeZone)`
- [ ] Unit tests cover midnight boundaries in the team timezone (rule R1), including the first and last minute of a sprint
- [ ] Failing tests committed before implementation

**Estimate:** 3 points
**PRD:** US-3, rule R1
**Depends on:** #7
