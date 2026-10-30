## User story
As someone who wants retros to change something, I want to vote on what to improve and have the top items become next sprint's action items, so retros don't just get forgotten.

## Acceptance criteria
- [ ] Lead can open a retro for a sprint; members add items to "Went well" or "To improve"
- [ ] Each member has 3 votes per retro, max 1 per item; voting toggles; votes-remaining counter shown
- [ ] `VoteButton` disabled with an explanation when no votes remain
- [ ] When the lead closes the retro, the top 3 "To improve" items (ties: earliest created) become action items on the next sprint (rule R6)
- [ ] The next sprint's retro lists the previous action items with a done checkbox
- [ ] Vote tallying and action item selection are pure functions in `src/lib/retro/` with unit tests
- [ ] Failing tests committed before implementation

**Estimate:** 5 points
**PRD:** US-8, rule R6
**Depends on:** #8
