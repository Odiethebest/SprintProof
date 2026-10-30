## User story
As a team lead, I want to create a team linked to our GitHub repo and invite my partner and our TA, so everyone lands in the right place with the right role.

## Acceptance criteria
- [ ] Create a team with name, GitHub repo (`owner/name`, validated format) and timezone (default `America/Los_Angeles`); creator becomes `LEAD`
- [ ] Lead can generate a member invite link and an instructor invite link
- [ ] Invite links expire after 7 days and can be revoked
- [ ] Opening a valid link while signed in adds a membership with the link's role
- [ ] Opening a link when already a member does not create a duplicate
- [ ] Expired, revoked or unknown links show a clear error
- [ ] Only `LEAD` can create or revoke invites (403 otherwise)
- [ ] Integration tests cover every case above

**Estimate:** 5 points
**PRD:** US-2
**Depends on:** #6
