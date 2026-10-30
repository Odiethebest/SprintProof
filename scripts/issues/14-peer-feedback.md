## User story
As someone in a team of two, I want to leave partner feedback that only the instructor sees, so I can be honest without making things awkward.

## Acceptance criteria
- [ ] In the retro, each member can write feedback about each teammate: one entry per teammate per sprint
- [ ] Feedback is editable until the retro is closed
- [ ] The form is clearly labeled "Visible to instructors only"
- [ ] Only `INSTRUCTOR` users can read feedback (rule R7), enforced in repositories and route handlers
- [ ] Integration tests prove `MEMBER` and `LEAD` get 404 when requesting feedback, including their own team's
- [ ] Feedback never appears in exports made by `LEAD`

**Estimate:** 3 points
**PRD:** US-9, rule R7
**Depends on:** #13
