<!--
Title: <type>(<scope>): <imperative summary> (#<issue>)
One issue per PR, ideally under ~400 changed lines.
-->

Closes #

## What changed


## Acceptance criteria
<!-- Copy the checklist from the issue. Tick what this PR meets and say what's left. -->
- [ ] 

## TDD evidence
<!-- Required for src/lib/ and API routes. Delete for docs or chore PRs. -->
- Failing tests: <SHA of the `test(...)` commit>
- Implementation: <SHA of the `feat(...)` / `fix(...)` commit>

## How to verify
- Vercel preview: 
- Steps:

## Screenshots
<!-- UI changes only. Include a mobile-width shot. -->

## Checklist
- [ ] `npm run lint && npm run typecheck && npm test` pass locally
- [ ] Every acceptance criterion has at least one test
- [ ] External input validated with Zod; `requireTeamRole()` on every route and page that touches team data
- [ ] UI: loading, empty and error states; works with the keyboard; status never shown by color alone
- [ ] No secrets, tokens, standup text or peer feedback in logs
- [ ] `docs/api/openapi.yaml` updated (API changes) / decision record in `docs/decisions/` (big technical choices)

## For the reviewer
- Approve only when CI is green and the preview works.
- Leave at least one substantive comment: a question, a suggestion, or what you verified.
- Merge with "Create a merge commit" or "Rebase and merge". Never squash.
