# AGENTS.md — SprintProof

<!--
  This is the shared rules file for every AI coding tool on this project
  (Antigravity, Claude Code, Cursor, Copilot...). Tool-specific notes live in
  CLAUDE.md, .cursor/, .agents/ — never duplicate these rules there.
  Both partners maintain this file. Every change gets a line in the
  Changelog at the bottom so we can show how the rules evolved.
-->

## 0. How to use this file

- Read this whole file before writing code. When something here conflicts with your defaults, this file wins.
- Every task maps to exactly one GitHub Issue. Read the issue's acceptance criteria first; if there's no issue number, ask for one.
- If a rule here seems wrong or missing for the task at hand, say so and suggest an edit to this file instead of silently working around it.

---

## 1. Project context

### What we're building

SprintProof is an async Scrum log and contribution tracker for student software teams. Teams record standups, sprint planning and retros in the app; GitHub activity (commits, PRs, reviews) flows in through webhooks; a live dashboard shows each member's progress against the course requirements; TAs get a read-only summary and Markdown export.

**Non-goal:** SprintProof is not a task board. Tasks stay in GitHub Issues. Never build task/Kanban features.

### Product principle (applies to all features)

Show facts, not judgments. The app displays counts and whether requirements are met. It never ranks people, never computes a "contribution score", and never labels anyone as a low contributor. UI copy stays neutral: "1 standup to go", not "You're behind".

### Tech stack

<!-- Keep in sync with package.json. Update this table whenever we upgrade a major version. -->

| Area | Choice | Version |
| --- | --- | --- |
| Runtime | Node.js | 20 LTS or later |
| Framework | Next.js, App Router | 16.4 |
| UI | React | 19.3 |
| Language | TypeScript, `strict: true` | 5.9 |
| Styling | Tailwind CSS (tokens from `DESIGN.md`) | 4.3 |
| Database | PostgreSQL | 16+ |
| ORM | Prisma | pinned when added (#5) |
| Auth | Auth.js (`next-auth`) with GitHub provider, JWT session strategy | pinned when added (#6) |
| Validation | Zod | pinned when added (#7) |
| Real-time | Pusher Channels (`pusher` server, `pusher-js` client) | pinned when added (#12) |
| GitHub API | Octokit (`@octokit/rest`) | pinned when added (#11) |
| Unit / integration tests | Vitest | 5.0 |
| E2E tests | Playwright + `@axe-core/playwright` | 1.64 (Playwright); pinned when added (#17) (`@axe-core/playwright`) |
| CI/CD | GitHub Actions, Vercel | — |

### Architecture

```
src/
├── app/                          # Next.js routes ONLY: pages, layouts, route handlers
│   ├── (public)/signin/
│   ├── (app)/teams/[teamId]/
│   │   ├── dashboard/            # live contribution dashboard
│   │   ├── standups/             # check-in form + history
│   │   ├── sprints/[sprintId]/   # planning notes, retro
│   │   └── settings/             # repo connection, requirements, members, API tokens
│   ├── review/[teamId]/          # instructor/TA read-only view
│   └── api/
│       ├── auth/[...nextauth]/
│       ├── webhooks/github/      # GitHub webhook receiver
│       └── v1/                   # public, documented REST API (docs/api/openapi.yaml)
├── components/
│   ├── ui/                       # generic primitives (Button, Card, Badge...)
│   └── <feature>/                # feature components: dashboard/, standups/, retro/...
├── lib/                          # PURE business logic — no I/O
│   ├── checks/                   # requirement checks (standups, reviews per person)
│   ├── stats/                    # contribution counts per member per sprint
│   ├── sprints/                  # sprint date math, timezone boundaries
│   ├── retro/                    # vote tallying, action item selection
│   ├── github/                   # webhook payload → Activity mapping
│   └── export/                   # sprint summary → Markdown
├── server/                       # everything with side effects
│   ├── db.ts                     # single Prisma client
│   ├── repositories/             # all database reads/writes
│   ├── auth.ts                   # session helpers, requireTeamRole()
│   ├── github-client.ts          # Octokit wrapper
│   └── realtime.ts               # Pusher trigger wrapper
└── types/
prisma/schema.prisma
tests/unit/                       # mirrors src/lib/
tests/integration/                # API route handlers against a test database
tests/factories/                  # test data builders
e2e/                              # Playwright specs
```

### Key patterns

<!-- Why: keeping logic pure in src/lib is what makes red-green TDD fast and reviewable. -->

- **Layering is one-way:** `app/` → `server/` → `lib/`. Route handlers validate input with Zod, check authorization, call `server/` for data, call `lib/` for logic, and return a response. Nothing more.
- **`src/lib/` is pure.** It must not import from `next`, `@prisma/client`, `src/server/`, `fetch`, or read `process.env`. Inputs in, outputs out. Pass the current time in as an argument (`now: Date`); never call `new Date()` inside `lib/`.
- **Server Components by default.** Add `"use client"` only for components that need state, effects or event handlers. Load page data on the server through `server/repositories/`, not with `useEffect` + `fetch`.
- **All mutations go through route handlers** in `app/api/`. Do not use Server Actions; one mutation pattern keeps integration tests uniform.
- **Real-time flow:** webhook or mutation → write to DB → `server/realtime.ts` triggers `team-{teamId}` channel with a small event (`activity.created`, `standup.created`) → client refetches the affected section. Never push full records through Pusher.
- **API response shape:** success returns the resource or `{ data, nextCursor }` for lists. Errors always return `{ "error": { "code": "SNAKE_CASE_CODE", "message": "Human readable" } }` with the right HTTP status.

### Domain model and counting rules

<!-- Why: these rules are where AI-generated code most often guesses wrong. They are the spec for src/lib/. -->

Main Prisma models: `User`, `Team`, `Membership` (role: `LEAD` | `MEMBER` | `INSTRUCTOR`), `Sprint` (start/end dates, `standupsPerPerson`, `reviewsPerPerson`), `Standup`, `Activity` (type: `COMMIT` | `PR_OPENED` | `PR_MERGED` | `REVIEW`), `Retro`, `RetroItem`, `RetroVote`, `ActionItem`, `PeerFeedback`, `ApiToken`.

- **Timezone:** each team has a timezone (default `America/Los_Angeles`). Store timestamps in UTC; compute sprint boundaries in the team timezone. A sprint runs from 00:00 on its start date through 23:59:59.999 on its end date, inclusive.
- **Standups:** at most one counts per person per calendar day (team timezone). Editing the same day's standup updates it; it does not add a second one.
- **Reviews:** a review counts when a member submits a review (approved, changes requested, or commented) on a PR authored by someone else. Count distinct PRs per reviewer: three review submissions on the same PR count as one. Reviews on your own PR never count.
- **Commits:** deduplicate by SHA. Attribute by GitHub login mapped to a team member. Count commits from PR commit lists, not only the default branch, so merges don't hide authorship. Ignore bots (logins ending in `[bot]`).
- **Requirement status** for each member and requirement, computed in `lib/checks/`:
  - `MET`: count ≥ required
  - `ON_TRACK`: not met, sprint still running, more than 2 days left
  - `AT_RISK`: not met, sprint still running, 2 or fewer days left
  - `MISSED`: not met, sprint has ended
- **Retro votes:** each member gets 3 votes per retro, max 1 per item. The top 3 items in "To improve" by vote count (ties broken by earliest created) become `ActionItem`s for the next sprint.
- **Peer feedback** is visible only to users with the `INSTRUCTOR` role. Never return it to `LEAD` or `MEMBER`, in any page, API response or export.

### Naming conventions

| Thing | Convention | Example |
| --- | --- | --- |
| Files and folders | kebab-case | `requirement-check.tsx`, `standup-quota.ts` |
| React components | PascalCase, named export | `export function RequirementCheck()` |
| Functions, variables | camelCase, verb-first for functions | `countDistinctReviews()`, `sprintEnd` |
| Booleans | `is` / `has` / `can` prefix | `isSprintActive`, `hasSubmittedToday` |
| Constants, env vars | UPPER_SNAKE_CASE | `MAX_VOTES_PER_RETRO`, `DATABASE_URL` |
| Types, interfaces | PascalCase, no `I` prefix | `RequirementStatus`, `SprintSummary` |
| Zod schemas | camelCase + `Schema` | `createStandupSchema` |
| Prisma models | PascalCase singular; tables mapped to snake_case plural with `@@map` | `model RetroVote` → `retro_votes` |
| API routes | plural nouns, kebab-case, versioned | `/api/v1/teams/{teamId}/sprints` |
| Unit/integration tests | `<name>.test.ts`, mirroring source path | `tests/unit/checks/standup-quota.test.ts` |
| E2E tests | `<flow>.spec.ts` | `e2e/daily-standup.spec.ts` |

### Coding standards

- TypeScript strict. No `any`; use `unknown` and narrow. No `@ts-ignore`. Non-null assertions (`!`) only in tests.
- Named exports everywhere, except where Next.js requires a default export (`page.tsx`, `layout.tsx`, etc.).
- Small functions with early returns. If a function needs a comment to explain *what* it does, split it; comments explain *why*.
- No `console.log` in committed code.
- Format with Prettier and lint with ESLint (Next.js config). Never disable a lint rule without a comment explaining why.

### Testing strategy

<!-- Why: TDD must be visible in git history — the P2 rubric checks for failing-test commits before implementation. -->

- **TDD is mandatory for `src/lib/` and API routes.** Red → green → refactor, as separate commits (see section 3).
- **Unit tests (Vitest)** for every function in `src/lib/`. Coverage goal: ≥ 90% lines for `src/lib/`, ≥ 80% overall.
- **Integration tests (Vitest)** call route handlers directly against a real PostgreSQL test database (reset between test files). Mock only external services at their wrappers: `server/github-client.ts` and `server/realtime.ts`.
- **E2E tests (Playwright)** cover the user flows in section 2. Each flow includes an `@axe-core/playwright` accessibility check with no serious or critical violations.
- E2E sign-in uses a test-only credentials provider that is enabled **only** when `E2E_TEST_AUTH=true`. It must never be enabled in production; CI asserts this.
- Test structure: Arrange / Act / Assert. One behavior per test. Names describe behavior: `it("counts three reviews on the same PR as one")`.
- Build test data with `tests/factories/`, not inline object literals repeated across files.
- Every acceptance criterion in the issue maps to at least one test. Edge cases to always consider: empty sprint, sprint boundary at midnight, member with no GitHub login, bot activity, duplicate webhook delivery.
- Never weaken, skip, or delete a test to make it pass.

---

## 2. PRD and design references

<!-- Why: the AI should build from our PRD and mockups, not invent its own UI. Update this section whenever the mockups change. -->

- **PRD:** [`docs/PRD.md`](docs/PRD.md) — problem, user stories, acceptance criteria, out-of-scope list.
- **Design system:** [`DESIGN.md`](DESIGN.md) — colors, type scale, spacing, component rules. Use only its tokens.
- **Mockups:** [`docs/design/`](docs/design/) — screenshots of the interactive prototype built in Claude Artifacts (link in `docs/design/README.md`). When implementing a screen, open its mockup first and match the layout, hierarchy and copy. The control bar above the app in the prototype (Pretend today, View as, Theme, Simulate GitHub review, Reset demo) is a demo tool, not part of the product: don't build it.

### Screens

Every signed-in page shares one top bar: the team mark, the team name with the repo (`owner/name`) under it, a sprint selector (`Sprint 1 · Oct 29 – Nov 4 · Current`; past sprints say `Ended`, future sprints aren't listed), the `LiveIndicator`, and a user menu (avatar, name, `@login`, role pill, "Sign out"). Each page opens with a page title and a muted meta line.

1. **Sign-in** (`/signin`, `01-signin.png`): one centered card with the app mark, "Sign in to SprintProof", a one-line pitch, a full-width "Sign in with GitHub" button, and one sentence on which GitHub fields we use. A signed-out visitor sent here from a team page also sees "Sign in to continue to <page>."
2. **Team dashboard** (`/teams/[teamId]/dashboard`, `02-dashboard.png`, `02-dashboard-mobile.png`): the title is the sprint name; the meta line has the dates, days left (or "Ended Nov 4") and the sprint's requirements ("3 standups and 5 PR reviews per person"). Below it come a `RequirementSummary` for the signed-in member, one `MemberCard` per member (two columns, signed-in member first), and the `ActivityFeed` on the right. Below `lg` the feed stacks under the cards; at 390 px everything is one column. Instructors see the same page with a "Read-only" pill and no summary.
3. **Standups** (`/teams/[teamId]/standups`, `03-standup.png`): the meta line says "One standup per person per day" and "Days follow <team timezone>". The left column holds the `StandupForm`. The right, two columns wide, holds "History" for the selected sprint: grouped by day, newest first; each day heading shows the weekday, date and count; each entry shows avatar, name, time ("edited" if changed) and Yesterday / Today / Blockers side by side ("None" when empty). Instructors see only the history, full width.
4. **Retro** (`/teams/[teamId]/sprints/[sprintId]/retro`, `04-retro.png`): the title is "Sprint N retro"; the meta line has an Open or Closed pill and "3 votes each, 1 per item"; on the right sit the votes-remaining pill ("2 of 3 votes left") and the lead's "Close retro" button. Below, top to bottom: the action items panel, the two `RetroColumn`s side by side ("Went well", "To improve"), and the `PeerFeedbackForm`.
5. **Review** (`/review/[teamId]`, `05-instructor.png`): the title is "Sprint N review"; the meta line has the dates, days left, requirements and a "Read-only" pill; the `ExportButton` sits on the right. Cards: "Requirements" (a table with one row per member: standups and PR reviews as count plus `StatusLabel`, commits, PRs, and "Counts as of <date>"), "Standups" by day, "Retro" (both columns with vote counts, and the action items for the next sprint or "Set when the lead closes the retro"), and, for `INSTRUCTOR` only, "Peer feedback" with one entry per author and teammate ("Ziqi (Odie) Yang about Yunhong Huang", or "Not submitted yet"). No edit controls are rendered at all. A `LEAD` can open this page too: it shows the same summary without the peer feedback card, plus a note that peer feedback is left out of the page and of the export.
6. **Settings** (`/teams/[teamId]/settings`, `06-settings.png`), two columns on desktop:
   - **Repository:** the connected repo marked "Connected"; a team timezone select ("Sprint days and standup dates use this timezone."); the webhook URL with "Copy"; the subscribed events; the last delivery marked "Verified"; the masked webhook secret with "Rotate secret"; collapsible "Webhook setup steps"; and "Unmapped activity", which lists GitHub logins that aren't on the team (stored, not counted) and bots (ignored).
   - **Members and invites:** members with role pills; a member invite link and an instructor invite link, each with its expiry date, "Copy link" and "Revoke", or "Create link" when none is active.
   - **Sprints and requirements** (full width): a table of sprints (dates, standups per person, PR reviews per person, Ended / Current / Upcoming, "Edit"). "Add sprint" opens an inline form (name, start date, end date, standups per person defaulting to 3, PR reviews per person defaulting to 5) with field errors for an end date before the start date, an overlap (naming the other sprint), and numbers outside 1–20.
   - **API tokens** (full width): the user's tokens (name, `spk_live_••••` plus the last 4 characters, created and last used dates, "Revoke"), then a "New token name" field with "Create token". A new token appears once, in a highlighted box with "Copy token" and "Copy your new token now. You won't see it again."
   - Lead-only controls (timezone, webhook URL and secret, setup steps, invites, adding and editing sprints) aren't rendered for anyone else.

### Key components and expected behavior

- **`RequirementSummary`:** one line for the signed-in member: a `StatusLabel` for their least favorable open requirement and a plain sentence ("You've met 1 of 2 requirements. 3 PR reviews to go."; after the sprint, "Sprint 1 has ended. You met 1 of 2 requirements.").
- **`RequirementChecklist`:** one row per requirement: status icon, label, count ("Standups 2 / 3"), status label, and "1 to go" while the requirement is open and the sprint is running. Status always pairs an icon with a text label (`Met`, `On track`, `At risk`, `Missed`), never color alone. Screen readers hear "2 of 3".
- **`MemberCard`:** avatar, name ("(you)" for the signed-in member), `@login` and role pill; commits, PRs, reviews and standups as four tiles in a 2×2 grid; the `RequirementChecklist` below a divider. Counts only: no percentages of the team, no ranking, no comparison arrows.
- **`ActivityFeed`:** "Activity", "From GitHub and standups, newest first": the 20 most recent items in the selected sprint. Items are standups, PRs opened, reviews ("approved", "requested changes on" or "commented on" #N) and commits grouped per member per day ("pushed 3 commits" with the latest message). Each row has an icon, the actor's name, the PR title or standup text, and the time.
- **`LiveIndicator`:** a dot and "Live" when the Pusher connection is up, "Reconnecting…" otherwise. When an update arrives, the affected section refetches, the changed count gets the highlight from `DESIGN.md` §8, and the change is announced through the page's `aria-live="polite"` region ("Ziqi (Odie) Yang approved #105. PR reviews 3 of 5, at risk.").
- **`StandupForm`:** "Today's standup", with the date and the sprint it files under. Yesterday and Today required, Blockers optional, 1000 characters each with a counter; errors appear under the field ("Add what you worked on yesterday."). It always files under the current sprint, even when the selector shows another one. If the user already posted today, it opens prefilled with "Posted at 9:05 AM. Saving again updates it." and the button says "Update today's standup". If today isn't inside any sprint, it explains that in place of the form.
- **`RetroColumn`:** title, item count, items sorted by votes (ties: earliest first) with the author's name and a `VoteButton`, and an "Add item" field with an "Add" button at the bottom.
- **`VoteButton`:** `ThumbsUp` and the vote count; toggles the user's vote (`aria-pressed`) and is filled when the user has voted. With no votes left it is `aria-disabled` and shows the tooltip "No votes left".
- **Action items panel:** "Carried into Sprint N" (the previous retro's top 3 "To improve" items) and "For Sprint N+1". While the retro is open, the second list previews what closing it now would produce.
- **Close retro:** the lead's button opens a confirmation dialog listing the items that will become action items. After closing, items, votes and partner feedback are read-only.
- **`PeerFeedbackForm`:** a "Partner feedback" card with a lock icon and "Visible to instructors only. You can edit it until the retro closes."; one textarea per teammate ("Feedback for Yunhong Huang"), "Save feedback", and the saved date.
- **`ExportButton`:** "Export Markdown" opens a dialog titled with the file name (`sprint-N-summary.md`). It says whether peer feedback is included ("Instructor export. Includes peer feedback." or "Team export. Peer feedback is left out."), shows a Markdown preview, and offers "Copy Markdown" and "Download". The format matches the files in `docs/sprints/`.
- **Confirmations:** closing a retro and revoking a token go through a dialog; focus returns to the trigger when it closes.
- **Empty states:** every list has one, with a next step ("No standups in Sprint 1 yet." with "Post today's standup").

### User flows

1. **Onboarding:** sign in with GitHub → create a team (becomes `LEAD`) or open an invite link (becomes `MEMBER`) → in Settings the lead copies the webhook URL and secret into GitHub, following "Webhook setup steps" → the lead adds Sprint 1 under "Sprints and requirements" → dashboard.
2. **Daily standup:** standups page → fill in "Today's standup" → "Post standup" → the entry appears at the top of History, and teammates' dashboards update the standup count live. Posting again the same day updates that entry ("Update today's standup").
3. **GitHub activity:** a member opens or reviews a PR on GitHub → the webhook hits `/api/webhooks/github` → signature verified → `Activity` stored (idempotent) → Pusher event → within seconds the item appears in the activity feed and the changed count is highlighted; Settings shows it as the last verified delivery.
4. **End of sprint:** the lead opens the retro → members add items to "Went well" and "To improve" and vote (3 each, max 1 per item) → each member saves partner feedback → the lead clicks "Close retro" and confirms → the top 3 "To improve" items become action items, listed as "Carried into" on the next sprint's retro → the lead exports the team summary from the review page, without peer feedback.
5. **Instructor:** opens an instructor invite link → `INSTRUCTOR` membership → read-only review page with peer feedback → "Export Markdown" includes the peer feedback.

---

## 3. Scrum and workflow

### GitHub Issues and the board

- Board columns: Backlog → Sprint Todo → In Progress → In Review → Done.
- Move the issue to **In Progress** when its branch is created and to **In Review** when the PR opens. Merging with `Closes #N` moves it to Done.
- Milestones: "Sprint 1" (Oct 29 – Nov 4, 2026), "Sprint 2" (Nov 5 – Nov 11, 2026).

### Branch naming

`<type>/<issue-number>-<short-kebab-description>`

Types: `feature`, `fix`, `chore`, `docs`, `test`, `refactor`.
Examples: `feature/12-standup-form`, `fix/31-duplicate-webhook-delivery`.

One branch per issue. Branch from the latest `main`.

### Commit messages

[Conventional Commits](https://www.conventionalcommits.org/), always ending with the issue number:

```
<type>(<scope>): <imperative summary> (#<issue>)
```

Scopes: `auth`, `teams`, `sprints`, `standups`, `github`, `checks`, `dashboard`, `retro`, `export`, `api`, `ui`, `db`, `ci`, `docs`.

**TDD commit sequence (required for logic and API work):**

```
test(checks): add failing tests for review quota (#7)      ← tests fail here
feat(checks): count distinct reviewed PRs per member (#7)   ← tests pass
refactor(checks): extract sprint window helper (#7)         ← optional
```

The `test(...)` commit must contain only tests (and factories/fixtures). AI tools: after writing failing tests, stop. The developer commits them, or explicitly asks the AI tool to, before implementation starts. AI tools commit or push only when the developer explicitly asks, under the developer's own git identity.

### Pull requests

- Title uses the commit format. Body follows `.github/pull_request_template.md` and includes `Closes #N`.
- Requirements to merge: CI green, Vercel preview working, **at least one approving review from your partner**. Never merge your own PR without that approval.
- Merge with **"Create a merge commit" or "Rebase and merge" — never "Squash and merge"**. Squashing collapses the test-first commits and erases the TDD evidence.
- Keep PRs small: one issue, ideally under ~400 changed lines.
- Reviewers leave at least one substantive comment (a question, a suggestion, or what was verified), not just "LGTM".

### Referencing issues in code

- TODOs must carry an issue number: `// TODO(#23): handle force-pushed commits`. No bare TODOs.
- When code implements a non-obvious rule from section 1, cite it: `// Counting rule: reviews on own PR never count (AGENTS.md §1)`.
- Big technical choices get a decision record in `docs/decisions/NNN-title.md` and are linked from the PR.

### Sprint records

Standups, planning notes and retros for our own team are recorded in SprintProof and exported into `docs/sprints/sprint-N/` (`planning.md`, `standups.md`, `retro.md`). Until the app can export, add entries to those files by hand on the day they happen.

---

## 4. Do's and don'ts

### Do

- Validate every external input with Zod: request bodies, query params, route params, webhook payloads.
- Call `requireTeamRole(teamId, roles)` at the top of every route handler and server page that touches team data.
- Put logic in `src/lib/` as pure functions and test it first.
- Use design tokens from `DESIGN.md` through Tailwind classes.
- Write UI copy that is short, neutral and specific.
- Handle loading, empty and error states for every data view.

### Don't

- Don't put business logic in components or route handlers.
- Don't fetch server data with `useEffect` when a Server Component can load it.
- Don't use inline styles, arbitrary hex colors (`text-[#3b82f6]`), or one-off spacing values.
- Don't add task-management features, rankings or contribution scores.
- Don't store tokens in `localStorage` or expose secrets to the client (only `NEXT_PUBLIC_*` vars reach the browser).
- Don't use snapshot tests as the only test for a component.
- Don't add a dependency without asking first and stating why.

### Preferred libraries

| Need | Use | Avoid |
| --- | --- | --- |
| HTTP requests | native `fetch` | axios |
| Dates and timezones | `date-fns` + `@date-fns/tz` | moment, dayjs |
| Validation | Zod | yup, hand-rolled checks |
| Utilities | native JS | lodash |
| Class names | `clsx` + `tailwind-merge` (`cn()` helper) | string concatenation |
| Icons | `lucide-react` | icon fonts, other icon sets |
| UI primitives | shadcn/ui components copied into `components/ui/` | other component libraries |
| Global client state | not needed; Server Components + refetch on Pusher events | Redux |
| Webhook signature | Node `crypto` (`createHmac`, `timingSafeEqual`) | custom string compare |

### Security requirements

- Secrets come only from environment variables. Never hardcode or log them. `.env.example` lists names only.
- **Webhooks:** verify `X-Hub-Signature-256` with HMAC-SHA256 over the raw request body using `timingSafeEqual`; reject with 401 on mismatch. Deduplicate by `X-GitHub-Delivery` so redelivered events are stored once.
- **Authorization:** check team membership and role on the server for every request. Hiding a button is not access control.
- **Peer feedback:** enforced in repositories and route handlers, not just the UI. Integration tests must prove a `MEMBER` gets 403/404 for peer feedback.
- **API tokens:** generate with `crypto.randomBytes`, show once, store only a SHA-256 hash. Public API endpoints require `Authorization: Bearer <token>`.
- **GitHub OAuth:** request the minimum scopes needed; the choice and reasoning live in `docs/decisions/`.
- **Database:** only Prisma queries or `$queryRaw` tagged templates. Never build SQL with string concatenation.
- Never log request bodies that may contain standup text, feedback, or tokens.

### Accessibility requirements

- Target WCAG 2.1 AA.
- Semantic HTML first: real `<button>`, `<nav>`, `<main>`, headings in order.
- Every input has a visible `<label>`. Errors are linked with `aria-describedby`.
- Everything works with the keyboard; focus is always visible.
- Status is never shown by color alone; pair it with an icon and text.
- Text contrast at least 4.5:1 (3:1 for large text).
- Live updates are announced politely (`aria-live="polite"`), never by stealing focus.

---

## Changelog

<!-- Required for HW3: record every meaningful change to these rules and why. -->

| Date | Author | Change | Why |
| --- | --- | --- | --- |
| 2026-10-28 | Ziqi (Odie) Yang, Yunhong Huang | v1: initial rules | Project kickoff |
| 2026-10-28 | Ziqi (Odie) Yang | AI tools may commit and push when the developer explicitly asks, under the developer's own git identity (§3) | Saves a hand-off step; authorship stays accurate because commits still use the developer's identity |
| 2026-10-28 | Ziqi (Odie) Yang | Peer feedback rule (§1) also covers exports | Issue #1 review by Yunhong: AGENTS.md left out exports, so it didn't match PRD rule R7 |
| 2026-10-28 | Yunhong Huang | Pinned tech stack versions from package.json | Issue #3 |
| 2026-10-28 | Ziqi (Odie) Yang | §2 rewritten to match prototype screenshots | Issue #2: rules must describe the real mockups |
