# 004. Count each commit once, and leave out GitHub's own commits on the default branch

**Date:** 2026-11-11 · **Status:** Accepted · **Issue:** #78 (decision), #114 (fix)
**Deciders:** Ziqi (Odie) Yang; Yunhong Huang to confirm in review

## Context
R4 counts commits from `push` events on any branch, deduplicated by SHA and credited to the commit author (decision 001, #11). The same change can still count more than once:
- a local rebase, an amend followed by a force-push, or GitHub's "Rebase and merge" makes a copy with a new SHA and the same author;
- "Create a merge commit" on GitHub adds a merge commit credited to whoever clicked merge, and a squash merge adds one more commit for the PR author.

The Nov 9 audit (#78) checked this with the real mapper and counter: a feature commit plus its rebased copy on `main` counts as 2. On our own team, 64 of the 185 commits counted for Ziqi in Sprint 2 were merge commits: 42 made by GitHub's merge button and 22 made locally to bring `main` into a branch.

## Options considered
1. **Leave out commits that GitHub makes on the default branch** (committer `web-flow`, GitHub's account for commits it creates): pros: drops merge commits and the copies a rebase merge makes, and the PR's own commits were already counted from the branch pushes / cons: also drops commits someone writes in GitHub's web editor directly on the default branch; doesn't catch a local rebase.
2. **Deduplicate by author, author date and message:** pros: catches local rebases, amends that keep the message, and force-pushed copies / cons: two genuinely separate commits with the same author, second and message would count once (rare).
3. **Accept and document the inflation:** pros: no change / cons: counts stay wrong, and the merger is credited for every merge.

## Decision
Options 1 and 2 together. A commit counts once per author, author date and full message, and commits on the repository's default branch whose committer is GitHub (`web-flow`) don't count. Dedup by SHA and the bot rule stay as they are.

## Consequences
- R4 in `docs/PRD.md`, AGENTS.md §1 Commits and the README Counting Rules change in the PR for #114, together with the code.
- Commit counts drop for whoever merges PRs on GitHub. Counts are facts about authored work, so this matches the product principle better.
- Commits written in GitHub's web editor straight onto the default branch no longer count. Commits made that way on a feature branch still do.
- Merge commits made locally (for example merging `main` into a feature branch) are authored by a developer, not GitHub, so they still count once each.
