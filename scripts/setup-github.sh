#!/usr/bin/env bash
# Creates the labels, milestones and 17 issues for SprintProof.
#
# Usage (from the repo root):
#   gh auth login                          # once
#   bash scripts/setup-github.sh
#
# Optional:
#   PROJECT="SprintProof Board" bash scripts/setup-github.sh
#       Also adds every issue to that GitHub Project (create the project first;
#       needs the project scope: `gh auth refresh -s project`).
#   DELETE_DEFAULT_LABELS=1 bash scripts/setup-github.sh
#       Removes GitHub's default labels we don't use (keeps "bug").
#
# Safe to re-run: existing labels are updated, existing milestones and issues
# (matched by exact title) are skipped.

set -euo pipefail
cd "$(dirname "$0")/.."
ISSUES_DIR="scripts/issues"

command -v gh >/dev/null || { echo "GitHub CLI not found. Install it: https://cli.github.com"; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "Not signed in. Run: gh auth login"; exit 1; }

REPO=$(gh repo view --json nameWithOwner --jq .nameWithOwner)
echo "==> Setting up $REPO"

# ---------- Labels ----------
label() {
  gh label create "$1" --color "$2" --description "$3" --force >/dev/null
  echo "    label: $1"
}

echo "==> Labels"
label "feature"          "1D76DB" "New user-facing functionality"
label "bug"              "D73A4A" "Something isn't working"
label "chore"            "6E7781" "Setup, tooling, CI, dependencies"
label "docs"             "0075CA" "Documentation"
label "priority: high"   "B60205" "Needed for the sprint goal"
label "priority: medium" "FBCA04" "Important, not blocking"
label "priority: low"    "0E8A16" "Nice to have"

if [[ "${DELETE_DEFAULT_LABELS:-}" == "1" ]]; then
  for l in "documentation" "enhancement" "good first issue" "help wanted" "invalid" "question" "wontfix" "duplicate"; do
    gh label delete "$l" --yes >/dev/null 2>&1 && echo "    deleted default label: $l" || true
  done
fi

# ---------- Milestones ----------
# GitHub keeps only the date part of due_on, stores it as 00:00 UTC and shows it in
# the viewer's timezone, so a Nov 4 due date displays as Nov 3 in the US. Sending
# noon UTC on the day after the sprint's last day makes it display as that last day.
day_after() {
  date -u -d "$1 +1 day" +%F 2>/dev/null || date -u -j -v+1d -f %F "$1" +%F
}

milestone() {
  local title="$1" last_day="$2" desc="$3" existing
  existing=$(gh api "repos/$REPO/milestones?state=all&per_page=100" --jq ".[] | select(.title==\"$title\") | .number")
  if [[ -n "$existing" ]]; then
    echo "    exists: $title"
  else
    gh api "repos/$REPO/milestones" -f title="$title" -f due_on="$(day_after "$last_day")T12:00:00Z" -f description="$desc" >/dev/null
    echo "    created: $title (due $last_day)"
  fi
}

echo "==> Milestones"
milestone "Sprint 1" "2026-11-04" "Oct 29 – Nov 4, 2026. Goal: sign in, set up sprints, post standups, requirement status computed correctly."
milestone "Sprint 2" "2026-11-11" "Nov 5 – Nov 11, 2026. Goal: live GitHub activity, retros, peer feedback, instructor view, export, public API, full CI/CD."

# ---------- Issues ----------
EXISTING_TITLES=$(gh issue list --state all --limit 500 --json title --jq '.[].title')

# Issue bodies reference each other by number (#1–#17). Numbers are only right
# if these are the first issues/PRs in the repo.
EXISTING_COUNT=$(gh api "repos/$REPO/issues?state=all&per_page=100" --jq 'length')
if [[ "$EXISTING_COUNT" -gt 0 ]] && ! grep -Fxq "Write PRD with user stories and acceptance criteria" <<<"$EXISTING_TITLES"; then
  echo
  echo "!! This repo already has $EXISTING_COUNT issue(s)/PR(s). New issues won't be numbered #1–#17,"
  echo "!! so the 'Depends on #N' links in the bodies will point to the wrong issues."
  read -r -p "Continue anyway? [y/N] " ok
  [[ "$ok" == "y" || "$ok" == "Y" ]] || exit 1
fi

issue() {
  local file="$1" title="$2" milestone="$3"; shift 3
  if grep -Fxq "$title" <<<"$EXISTING_TITLES"; then
    echo "    skip (exists): $title"
    return
  fi
  local args=(--title "$title" --body-file "$ISSUES_DIR/$file" --milestone "$milestone")
  local l
  for l in "$@"; do args+=(--label "$l"); done
  if [[ -n "${PROJECT:-}" ]]; then args+=(--project "$PROJECT"); fi
  local url
  url=$(gh issue create "${args[@]}")
  echo "    $url  $title"
}

echo "==> Sprint 1 issues"
issue 01-write-prd.md                 "Write PRD with user stories and acceptance criteria" "Sprint 1" "docs"    "priority: high"
issue 02-mockups-and-design.md        "Create UI mockups and design tokens"                 "Sprint 1" "docs"    "priority: high"
issue 03-scaffold-nextjs.md           "Scaffold Next.js app with Vitest and Playwright"     "Sprint 1" "chore"   "priority: high"
issue 04-ci-and-vercel.md             "Set up CI pipeline and Vercel deployments"           "Sprint 1" "chore"   "priority: high"
issue 05-prisma-schema.md             "Set up Prisma schema and database connection"        "Sprint 1" "chore"   "priority: high"
issue 06-github-sign-in.md            "Sign in with GitHub"                                 "Sprint 1" "feature" "priority: high"
issue 07-teams-and-invites.md         "Create a team and join via invite link"              "Sprint 1" "feature" "priority: high"
issue 08-sprints-and-requirements.md  "Create sprints with dates and requirements"          "Sprint 1" "feature" "priority: medium"
issue 09-daily-standup.md             "Submit and edit a daily standup"                     "Sprint 1" "feature" "priority: high"
issue 10-requirement-status.md        "Compute requirement status per member"               "Sprint 1" "feature" "priority: high"

echo "==> Sprint 2 issues"
issue 11-github-webhooks.md           "Receive and verify GitHub webhooks"                  "Sprint 2" "feature" "priority: high"
issue 12-live-dashboard.md            "Show live contribution dashboard"                    "Sprint 2" "feature" "priority: high"
issue 13-retro-voting.md              "Run a retro with voting and action items"            "Sprint 2" "feature" "priority: medium"
issue 14-peer-feedback.md             "Collect private peer feedback for instructors"       "Sprint 2" "feature" "priority: medium"
issue 15-instructor-view-export.md    "Add instructor view and Markdown export"             "Sprint 2" "feature" "priority: medium"
issue 16-public-api.md                "Publish public API v1 with tokens and OpenAPI docs"  "Sprint 2" "feature" "docs" "priority: medium"
issue 17-e2e-security-envs.md         "Add E2E suite, security scanning and environments"   "Sprint 2" "chore"   "priority: high"

echo
echo "==> Done. Next steps in the GitHub UI:"
echo "    1. Projects → your board: drag Sprint 1 issues to 'Sprint Todo', Sprint 2 issues to 'Backlog'."
echo "    2. Check both milestones show the right due dates (Issues → Milestones)."
echo "    3. Assign each issue to its owner (see docs/sprints/sprint-1/planning.md)."
