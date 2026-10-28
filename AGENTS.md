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
| Framework | Next.js, App Router | 16.x |
| UI | React | 19.x |
| Language | TypeScript, `strict: true` | 5.x |
| Styling | Tailwind CSS (tokens from `DESIGN.md`) | 4.x |
| Database | PostgreSQL | 16+ |
| ORM | Prisma | latest stable, pinned in `package.json` |
| Auth | Auth.js (`next-auth`) with GitHub provider, JWT session strategy | 5.x |
| Validation | Zod | latest stable |
| Real-time | Pusher Channels (`pusher` server, `pusher-js` client) | latest stable |
| GitHub API | Octokit (`@octokit/rest`) | latest stable |
| Unit / integration tests | Vitest | latest stable |
| E2E tests | Playwright + `@axe-core/playwright` | latest stable |
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
- **Peer feedback** is visible only to users with the `INSTRUCTOR` role. Never return it to `LEAD` or `MEMBER`, in any page or API response.

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
- **Mockups:** [`docs/design/`](docs/design/) — screenshots of the prototype built in Claude Artifacts. When implementing a screen, open its mockup first and match the layout and hierarchy.

### Screens

1. **Sign-in:** product name, one-line pitch, single "Sign in with GitHub" button.
2. **Team dashboard** (`/teams/[teamId]/dashboard`): sprint header with dates and days left; one `MemberCard` per member showing commits, PRs, reviews, standups; a `RequirementChecklist` per member; a `LiveIndicator` in the header; a recent activity feed on the right (stacks below on mobile).
3. **Standup check-in** (`/teams/[teamId]/standups`): `StandupForm` with three textareas (Yesterday, Today, Blockers), current sprint preselected; below it, the team's standups grouped by day.
4. **Retro** (`/teams/[teamId]/sprints/[sprintId]/retro`): two columns, "Went well" and "To improve"; each item has a `VoteButton`; a votes-remaining counter; an "Action items" panel; a separate private `PeerFeedbackForm` labeled "Visible to instructors only".
5. **Instructor view** (`/review/[teamId]`): read-only version of the dashboard plus peer feedback and an `ExportButton`. No edit controls rendered at all.
6. **Settings:** connect repository (with webhook setup instructions), sprint requirements, members and invites, API tokens.

### Key components and expected behavior

- **`RequirementChecklist`:** one row per requirement ("Standups 2/3"). Shows status with both an icon and a text label (`Met`, `On track`, `At risk`, `Missed`), never color alone.
- **`MemberCard`:** counts only. No percentages of the team, no ranking, no comparison arrows.
- **`LiveIndicator`:** shows "Live" when the Pusher connection is up, "Reconnecting…" otherwise. When an update arrives, the affected section refetches; announce it through an `aria-live="polite"` region.
- **`StandupForm`:** Yesterday and Today required, Blockers optional. If the user already submitted today, the form opens prefilled and the button says "Update today's standup".
- **`VoteButton`:** toggles the user's vote; disabled with an explanation when no votes remain.
- **`ExportButton`:** downloads `sprint-N-summary.md` in the same format we store in `docs/sprints/`.
- **Empty states:** every list has one, with a next step ("No standups yet this sprint. Add yours →").

### User flows

1. **Onboarding:** sign in with GitHub → create a team (becomes `LEAD`) or join with an invite link (becomes `MEMBER`) → lead connects the repo and adds the webhook → lead creates Sprint 1 with dates and requirements → dashboard.
2. **Daily standup:** open app → standups page → fill form → submit → appears in the list and the member's standup count updates live for teammates.
3. **GitHub activity:** member opens or reviews a PR on GitHub → webhook hits `/api/webhooks/github` → signature verified → `Activity` stored (idempotent) → Pusher event → dashboard counts update within seconds.
4. **End of sprint:** lead opens the retro → members add items and vote → top "To improve" items become action items for the next sprint → each member submits private peer feedback → lead exports the summary.
5. **Instructor:** opens an instructor invite link → `INSTRUCTOR` membership → read-only review page and export.

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
