# 006. Instructor invite links come from course staff or the team's instructors

**Date:** 2026-11-11 · **Status:** Accepted · **Issue:** #78 (decision), #116 (fix)
**Deciders:** Ziqi (Odie) Yang; Yunhong Huang to confirm in review

## Context
A LEAD can create an instructor invite link (`src/lib/invites/invite-link.ts`, AGENTS.md §2 Settings). With a second GitHub account, a lead could join their own team as INSTRUCTOR and read peer feedback once #14 ships. R7 says peer feedback is visible only to instructors, never to `LEAD` or `MEMBER`.

## Options considered
1. **Instructor links come only from course staff or an existing instructor:** pros: a team can't make its own instructor, so R7 holds without trusting the lead / cons: course staff need a way to reach a team they aren't on, and someone has to list who course staff are.
2. **Leads keep creating them, but an instructor join needs a confirmation the team can see:** pros: no new configuration / cons: the team members are the people R7 protects feedback from, so a confirmation they can see doesn't stop the problem.
3. **Keep the current rule and document the risk:** pros: no change / cons: R7 isn't really enforced.

## Decision
Option 1. Course staff are the GitHub logins in a server environment variable. They, and anyone who is already an INSTRUCTOR on the team, can create and revoke instructor links for that team. A LEAD can still create and revoke member links. Course staff who aren't on the team use the API with their session (for example from `/api-docs`).

## Consequences
- The variable's name, format and default (nobody) are documented in `.env.example`, the README and the PR for #116. PRD US-2 and R7, AGENTS.md §2 Settings and `docs/api/openapi.yaml` change in that PR.
- Settings no longer offers the lead an instructor link; it says where instructor links come from.
- Adding or removing course staff is a deployment change (env var and redeploy), not something a team can do.
