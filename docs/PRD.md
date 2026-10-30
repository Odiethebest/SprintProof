# SprintProof — Product Requirements Document

**Version:** 1.0 · **Date:** 2026-10-28 · **Authors:** Ziqi (Odie) Yang, Yunhong Huang
**Status:** Approved for Sprint 1 · **Tracking:** GitHub Issues #1–#17, milestones "Sprint 1" and "Sprint 2"

---

## 1. Summary

SprintProof is an async Scrum log and contribution tracker for student software teams. Teams record standups, sprint planning and retros in one place; GitHub activity (commits, PRs, reviews) flows in automatically through webhooks; a live dashboard shows each member's progress against the course's requirements; instructors get a read-only summary and a one-click Markdown export.

## 2. Problem

Project courses require visible Scrum evidence: a minimum number of standups per sprint, a minimum number of PR reviews per partner, retrospectives with partner feedback, and balanced contributions. Today that evidence lives in scattered Slack threads and is reconstructed the night before the deadline. By then it is too late to notice that someone is one standup short or has reviewed only one PR. GitHub holds the activity data, but nobody counts it per person per sprint, so instructors end up guessing who did what.

## 3. Goals and non-goals

### Goals

- G1. Make recording standups, planning and retros faster than posting in Slack.
- G2. Show every member, at any time, which course requirements they have met for the current sprint.
- G3. Reflect GitHub activity on the dashboard within seconds, without manual entry.
- G4. Let an instructor understand a team's sprint in under a minute, from one page or one exported file.

### Non-goals

- Task or issue management. Tasks stay in GitHub Issues; SprintProof never adds a task board.
- Ranking or scoring people. SprintProof shows counts and requirement status, never a "contribution score" or leaderboard.
- Grading. Instructors make grading decisions; SprintProof only presents evidence.

## 4. Users and roles

| Role | Who | Can do |
| --- | --- | --- |
| `MEMBER` | A student on the team | Submit standups, add retro items and votes, submit private peer feedback, view the team dashboard |
| `LEAD` | The student who created the team | Everything a member can, plus: connect the repo, create sprints and set requirements, invite people, open and close retros, export (without peer feedback) |
| `INSTRUCTOR` | TA or professor | Read-only access to everything, including peer feedback; export the full summary |

**Personas**

- **Maya (member)** works 20 hours a week alongside classes. She forgets to post standups and only realizes it when the sprint is over.
- **Leo (lead)** sets up the team and wants the requirements visible so he doesn't have to nag his partner.
- **Priya (TA)** grades a dozen teams and needs a clear, trustworthy summary instead of a Slack archive.

## 5. User stories and acceptance criteria

Each story maps to a GitHub Issue. The issue holds the detailed, testable checklist; this section is the summary.

### Epic A — Access and teams

**US-1. Sign in with GitHub** · Issue #6
As someone tired of new accounts, I want to sign in with GitHub, so my activity shows up without creating another login.
- Single "Sign in with GitHub" button; no passwords.
- First sign-in creates a user with GitHub id, login, name and avatar.
- Signed-out visitors to any team page are redirected to sign-in.

**US-2. Create a team and invite people** · Issue #7
As a team lead, I want to create a team linked to our GitHub repo and invite my partner and our TA, so everyone lands in the right place with the right role.
- Creator becomes `LEAD`; team stores repo (`owner/name`) and timezone (default `America/Los_Angeles`).
- Separate member and instructor invite links; links expire after 7 days and can be revoked.
- Opening a valid link adds the right role; opening it twice never duplicates membership.

### Epic B — Sprints and standups

**US-3. Plan sprints with requirements** · Issue #8
As a team lead, I want to create sprints with dates and the course's requirements, so the checks match our syllabus.
- Sprint has name, start date, end date, standups per person (default 3), PR reviews per person (default 5).
- Sprints in one team cannot overlap; end date is on or after start date.
- The current sprint is the one containing today in the team's timezone.

**US-4. Post an async standup** · Issue #9
As someone who forgets standups, I want a quick three-question check-in that files itself under the right sprint, so the record builds on its own.
- Yesterday and Today required, Blockers optional.
- One standup per person per day; submitting again the same day updates it.
- Standups are listed by day, newest first, visible to the whole team.

### Epic C — Contribution tracking

**US-5. See what's missing** · Issue #10
As someone who hates deadline surprises, I want the app to tell me which requirements I've met and what's left, so I can fix gaps in time.
- For each member and requirement: count, required number, and status (`MET`, `ON_TRACK`, `AT_RISK`, `MISSED`) following the rules in section 6.
- Copy is neutral and specific ("3 more PR reviews"), never judgmental.

**US-6. Track GitHub activity automatically** · Issue #11
As a team member, I want our commits, PRs and reviews recorded automatically, so nobody types activity in by hand.
- Webhook endpoint accepts `push`, `pull_request` and `pull_request_review` events.
- Requests with an invalid signature are rejected.
- Redelivered events are stored once.

**US-7. Watch progress live** · Issue #12
As someone who never knows if we're on track, I want a dashboard that updates the moment something happens, so I can see where we stand anytime.
- Dashboard shows sprint dates, days left, per-member counts and requirement status.
- A new standup or GitHub event appears for teammates within 5 seconds without reloading.
- Updates are announced to screen readers politely.

### Epic D — Retrospectives

**US-8. Run a retro that leads somewhere** · Issue #13
As someone who wants retros to change something, I want to vote on what to improve and have the top items become next sprint's action items, so retros don't just get forgotten.
- Two columns: "Went well" and "To improve".
- Each member has 3 votes per retro, max 1 per item.
- When the lead closes the retro, the top 3 "To improve" items become action items on the next sprint.

**US-9. Give honest partner feedback** · Issue #14
As someone in a team of two, I want to leave partner feedback that only the instructor sees, so I can be honest without making things awkward.
- One feedback entry per teammate per sprint, editable until the retro closes.
- Only `INSTRUCTOR` users can read it — enforced on the server, not just hidden in the UI.

### Epic E — Instructors and integrations

**US-10. Review and export a sprint** · Issue #15
As a TA grading a dozen teams, I want a read-only sprint summary with one-click Markdown export, so I can see the whole story without digging through Slack.
- Read-only page with dashboard, standups, retro and peer feedback; no edit controls.
- Export downloads `sprint-N-summary.md`.

**US-11. Use our data elsewhere** · Issue #16
As someone who builds my own tools, I want a documented API for our sprint data, so I can use it outside the app.
- Personal API tokens, shown once, revocable.
- Versioned REST endpoints under `/api/v1`, documented in `docs/api/openapi.yaml` with Swagger UI.

### Platform work (no user story)

| Issue | Work |
| --- | --- |
| #1 | This PRD |
| #2 | UI mockups and `DESIGN.md` |
| #3 | Next.js scaffold with Vitest and Playwright |
| #4 | CI pipeline and Vercel deployments |
| #5 | Prisma schema and database setup |
| #17 | E2E suite, security scanning and environment management |

## 6. Business rules

These rules are the source of truth for `src/lib/` and are mirrored in `AGENTS.md` §1.

- **R1. Timezone.** Timestamps are stored in UTC. Sprint boundaries are computed in the team's timezone. A sprint runs from 00:00 on its start date through 23:59:59.999 on its end date, inclusive.
- **R2. Standups.** At most one standup counts per person per calendar day in the team's timezone.
- **R3. Reviews.** A review counts when a member submits a review (approved, changes requested, or commented) on a PR authored by someone else. Count distinct PRs per reviewer. Reviews on your own PR never count.
- **R4. Commits.** Deduplicate by SHA; attribute by GitHub login mapped to a team member; count commits from PR commit lists so merges don't hide authorship. Bots (logins ending in `[bot]`) are ignored for every activity type, not only commits.
- **R5. Requirement status.**
  - `MET`: count ≥ required
  - `ON_TRACK`: not met, sprint running, more than 2 days left
  - `AT_RISK`: not met, sprint running, 2 or fewer days left
  - `MISSED`: not met, sprint ended
  - Days left = the sprint's end date minus today's date, both in the team timezone, plus 1 (today counts). With a Nov 4 end: Nov 2 has 3 days left (`ON_TRACK`), Nov 3 has 2 (`AT_RISK`), Nov 4 has 1 (`AT_RISK`).
- **R6. Retro votes.** 3 votes per member per retro, max 1 per item. The top 3 "To improve" items by votes (ties broken by earliest created) become action items for the next sprint.
- **R7. Peer feedback visibility.** Readable only by `INSTRUCTOR`. Never returned to `LEAD` or `MEMBER` in any page, API response or export.

## 7. Screens

Detailed layout and component behavior are in `AGENTS.md` §2, visual tokens in [`DESIGN.md`](../DESIGN.md), and mockup screenshots in [`docs/design/`](design/).

1. Sign-in
2. Team dashboard
3. Standup check-in and history
4. Sprint planning and retro
5. Instructor review page
6. Settings (repo connection, requirements, members and invites, API tokens)

## 8. Non-functional requirements

- **Performance:** dashboard first load under 2 seconds on a typical connection; live updates within 5 seconds of the triggering event.
- **Security:** webhook signatures verified; server-side authorization on every request; API tokens stored hashed; no secrets in the client or the repo.
- **Accessibility:** WCAG 2.1 AA; status never shown by color alone; full keyboard support.
- **Responsiveness:** usable from 360 px wide phones to desktop.
- **Reliability:** webhook handling is idempotent; a missed live update never leaves the page wrong after a refresh.

## 9. Release plan

| Sprint | Dates | Goal |
| --- | --- | --- |
| Sprint 1 | Oct 29 – Nov 4, 2026 | A team can sign in, set up sprints, post standups, and see requirement status computed correctly (#1–#10) |
| Sprint 2 | Nov 5 – Nov 11, 2026 | GitHub activity flows in live; retros, peer feedback, instructor view, export, public API, full E2E and security in CI (#11–#17) |
| Submission | Nov 12, 2026 | Production deployment, documentation, demo video |

## 10. Success measures

- Our own team runs P2 entirely on SprintProof: every standup and retro in `docs/sprints/` is exported from the app.
- A GitHub review shows up on the dashboard within 5 seconds in the demo.
- An instructor can answer "did each partner meet the standup and review requirements?" from one page.

## 11. Out of scope

Task boards, chat, notifications by email or push, grading, contribution scores or rankings, support for GitLab or Bitbucket, multi-course instructor dashboards (stretch goal only).

## 12. Open questions

- **OAuth scope:** reading private repos needs the broad `repo` scope; a GitHub App would allow finer read-only permissions but takes more setup. Decision to be recorded in `docs/decisions/001-github-oauth-scopes.md` (issue #6).
- **Webhook setup:** manual setup with instructions (planned) versus automatic creation through the API (stretch).
- **Unmapped activity:** how to show activity from GitHub logins that aren't team members (planned: store it, exclude it from counts, list it in settings).
