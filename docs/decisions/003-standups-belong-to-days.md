# 003. Standups belong to a team and a day, not a stored sprint

**Date:** 2026-11-09 · **Status:** Accepted · **Issue:** #56
**Deciders:** Ziqi (Odie) Yang

## Context
Each standup stored the sprint it was filed under, with one standup per sprint, person and day. Editing sprint dates (#8) didn't touch standups. A shorter sprint kept standups dated outside it, and those still counted. Moving a day from one sprint to the next let a person post a second standup on that day, filed under the new sprint. Yunhong found this while reviewing PR #51.

## Options considered
1. **Reject date edits that would leave out a day with standups:** pros: smallest change, no migration / cons: a lead can't fix wrong sprint dates once someone has posted, and a day can never move to another sprint.
2. **Keep `sprintId`, make it nullable, and re-link standups when sprint dates change:** pros: read queries stay the same / cons: the sprint is stored twice (as `sprintId` and as the date), the sync code must run on every sprint create and edit, and a standup posted during an edit can still end up in the wrong sprint.
3. **Drop `sprintId` and list a sprint's standups by date:** pros: a standup is always in the sprint that contains its day, nothing to keep in sync, and the database enforces one standup per person, team and day / cons: a migration that drops a column, and every read changes from `sprintId` to a date range.

## Decision
Option 3. `Standup` has `teamId` instead of `sprintId`, with a unique key on `(teamId, userId, date)`. A sprint's standups are the team's standups from its start date through its end date. GitHub activity already works this way, by timestamp. The repository still returns `sprintId` (the sprint a standup is listed under), so the public API's standup fields don't change.

## Consequences
- Migration `20261109224149_standups_belong_to_team` fills in `team_id` from each standup's old sprint, then drops `sprint_id`. Creating the unique index fails if someone already has two standups on one day in a team. Check for that before running `migrate deploy` on Supabase, and fix it by hand if needed.
- A standup on a day that no sprint covers isn't shown or counted, but it's kept. It shows again once a sprint covers that day.
- Deleting a sprint (there's no route for it yet) would keep its standups; deleting a team deletes them.
