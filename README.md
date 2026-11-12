# SprintProof: Async Scrum Log for Student Teams

> Standups, sprint planning and retros in one place, GitHub activity synced automatically, and a clear record of who did what. Your sprint, on the record.

[![CI](https://github.com/Odiethebest/SprintProof/actions/workflows/ci.yml/badge.svg)](https://github.com/Odiethebest/SprintProof/actions/workflows/ci.yml)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql)](https://www.postgresql.org/)
[![Scrum](https://img.shields.io/badge/Agile-Scrum-E67E22)](#team--collaboration)
[![TDD](https://img.shields.io/badge/Test--Driven%20Development-C21325)](#testing)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

---

## Table of Contents

- [Overview](#overview)
- [Team & Collaboration](#team--collaboration)
- [Architecture](#architecture)
- [Repository Structure](#repository-structure)
- [Getting Started](#getting-started)
- [GitHub Integration](#github-integration)
- [Deployment](#deployment)
- [Testing](#testing)
- [Counting Rules](#counting-rules)
- [Documentation](#documentation)
- [Implementation Status](#implementation-status)
- [Demo & Links](#demo--links)
- [License](#license)

---

## Overview

Project courses ask for real Scrum evidence: standups every sprint, PR reviews from every partner, retros with honest feedback. In practice that evidence ends up scattered across chat threads and gets pieced together the night before it's due, which is too late to notice anyone is falling short. GitHub already has the activity data; nobody is counting it per sprint. SprintProof does the counting and keeps the record as you go. For user stories, acceptance criteria and the out-of-scope list, read the [PRD](docs/PRD.md).

Core workflow:

1. **Sign in and connect.** Sign in with GitHub, create a team or join with an invite link. The team lead invites members, connects the repository and adds the webhook; [course staff send the instructor link](#instructor-invite-links).
2. **Plan the sprint.** The lead sets sprint dates and per-person requirements (standups, PR reviews).
3. **Async standups.** A three-question check-in (yesterday, today, blockers), filed under the current sprint automatically.
4. **Live GitHub activity.** Commits, PRs and reviews arrive through [GitHub webhooks](#github-integration) and the dashboard updates within seconds.
5. **Requirement checks.** Each member sees neutral, specific status such as "1 standup to go" or "3 more PR reviews this sprint".
6. **Retros that lead somewhere.** Members vote on items; the top-voted "To improve" items become next sprint's action items. Partner feedback is visible only to instructors.
7. **Instructor view and export.** A read-only sprint summary with one-click Markdown export, plus a documented [public REST API](docs/api/openapi.yaml).

Two product principles shape every feature:

- **Not a task board.** Tasks stay in GitHub Issues. SprintProof handles the Scrum side.
- **Facts, not judgments.** The app shows counts and whether requirements are met. It never ranks people, computes a contribution score, or labels anyone a low contributor.

| Role | Can do |
|---|---|
| Team member | Submit standups, join retros, view the team dashboard |
| Team lead | Everything a member can, plus create sprints, set requirements, connect the repo |
| Instructor / TA | Read-only access to team summaries, peer feedback and exports |

Built for CS6983 Project 2, Fall 2026.

---

## Team & Collaboration

SprintProof is built by two people:

| Member | GitHub | Role |
|---|---|---|
| Ziqi (Odie) Yang | [@Odiethebest](https://github.com/Odiethebest) | Product, design and app features |
| Yunhong Huang | [@santiaojun](https://github.com/santiaojun) | Platform and core logic |

Every task is a GitHub Issue on the project board (Backlog → Sprint Todo → In Progress → In Review → Done). Each issue gets its own branch (`feature/12-standup-form`, `fix/31-webhook-signature`), commits follow [Conventional Commits](https://www.conventionalcommits.org/) ending with the issue number, and `main` is protected: a pull request needs the seven required checks (lint and typecheck, unit tests, E2E tests, production build, dependency audit, dependency review, CodeQL) and an approving review from the other partner. So far Ziqi has merged every pull request, both partners'. 20 of the 65 were merged without an approval from the partner in place, using the repository owner's admin override; the [contribution log](docs/contribution-log.md#process-notes) lists them. We never squash-merge, because squashing erases the test-first commits. AI coding tools follow the same rules and commit or push only when the developer explicitly asks, under that developer's own git identity, so authorship in the git history stays accurate.

| Sprint | Dates | Milestone |
|---|---|---|
| Sprint 1 | Oct 29 – Nov 4, 2026 | "Sprint 1" |
| Sprint 2 | Nov 5 – Nov 11, 2026 | "Sprint 2" |

Planning notes, standups and retros live in [`docs/sprints/`](docs/sprints/). For the full conventions shared by humans and AI tools (branching, commits, PRs, coding standards, security), see [`AGENTS.md`](AGENTS.md). Contribution log: [`docs/contribution-log.md`](docs/contribution-log.md) (draft, finalized after the Sprint 2 retro).

---

## Architecture

```
Browser (GitHub OAuth via Auth.js, JWT session)
  → src/app/ page or route handler
       ↳ Zod validation + requireTeamRole()
  → src/server/repositories/ (Prisma → PostgreSQL)
  → src/lib/ (pure logic: checks, stats, retro, export)
  → Response (resource, { data, nextCursor }, or { error: { code, message } })

GitHub (push, pull_request, pull_request_review)
  → POST /api/webhooks/github
       ↳ verify X-Hub-Signature-256, dedupe by X-GitHub-Delivery
  → src/lib/github/ (payload → Activity)
  → src/server/repositories/ (store Activity, idempotent)
  → src/server/realtime.ts (small Pusher event on the team channel)
  → Browser refetches the affected section
```

Layering is one-way: `app/` → `server/` → `lib/`. Core business logic (requirement checks, contribution stats, retro action items) lives in `src/lib/` as pure functions with no framework, database or clock dependencies, which keeps red-green TDD fast. Pusher only carries small events; clients refetch the data. See [`docs/architecture.md`](docs/architecture.md) for the database schema diagram and design details.

| Layer | Choice |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, TypeScript 5, Tailwind CSS 4 |
| Backend | Next.js route handlers, Zod validation |
| Database | PostgreSQL 16 with Prisma ORM |
| Auth | GitHub OAuth via Auth.js (JWT sessions) |
| Real-time | GitHub webhooks → Pusher Channels |
| Testing | Vitest (unit + integration), Playwright + axe (E2E) |
| CI/CD | GitHub Actions, Vercel |

Exact versions are pinned in `package.json`.

---

## Repository Structure

```text
sprintproof/
├── .github/
│   ├── workflows/                    # CI, database migrations, production guard, CodeQL, dependency review
│   ├── ISSUE_TEMPLATE/
│   └── pull_request_template.md
├── .agents/ .cursor/ .claude/        # tool-specific scoped rules and skills only
├── docs/
│   ├── PRD.md                        # problem, user stories, acceptance criteria
│   ├── architecture.md               # system design + database schema diagram
│   ├── api/openapi.yaml              # public REST API reference
│   ├── decisions/                    # one record per big technical choice
│   ├── certs/                        # Supabase root CA, the value of DATABASE_CA_CERT
│   ├── research/
│   ├── design/                       # prototype mockups
│   └── sprints/
│       ├── sprint-1/                 # planning.md, retro.md, standups/<name>.md
│       └── sprint-2/
├── prisma/
│   └── schema.prisma
├── src/
│   ├── app/                          # Next.js routes only: pages, layouts, route handlers
│   │   ├── (public)/signin/
│   │   ├── (app)/teams/[teamId]/     # dashboard, standups, sprints, settings
│   │   ├── review/[teamId]/          # instructor / TA read-only view
│   │   └── api/                      # auth, GitHub webhook receiver, public v1 API
│   ├── components/
│   │   ├── ui/                       # generic primitives (Button, Card, Badge)
│   │   └── <feature>/                # dashboard/, standups/, retro/ ...
│   ├── lib/                          # pure business logic, no I/O
│   │   ├── checks/                   # requirement checks per member
│   │   ├── stats/                    # contribution counts per member per sprint
│   │   ├── sprints/                  # sprint date math, timezone boundaries
│   │   ├── retro/                    # vote tallying, action item selection
│   │   ├── github/                   # webhook payload → Activity mapping
│   │   └── export/                   # sprint summary → Markdown
│   ├── server/                       # everything with side effects
│   │   ├── db.ts                     # single Prisma client, TLS verified with DATABASE_CA_CERT
│   │   ├── repositories/             # all database reads/writes
│   │   ├── auth.ts                   # session helpers, requireTeamRole(), requireInviteAccess()
│   │   ├── github-client.ts          # Octokit wrapper
│   │   └── realtime.ts               # Pusher trigger wrapper
│   └── types/
├── tests/
│   ├── unit/                         # mirrors src/lib/
│   ├── integration/                  # route handlers against a test database
│   └── factories/                    # test data builders
├── e2e/                              # Playwright specs
├── AGENTS.md                         # shared rules for every AI coding tool
├── CLAUDE.md                         # imports AGENTS.md + Claude Code-only notes
├── DESIGN.md                         # UI tokens and component rules
├── .env.example                      # variable names only, never values
└── package.json
```

---

## Getting Started

### Prerequisites

- Node.js 20 or later
- A PostgreSQL database (local, or a free hosted one such as Neon or Supabase)
- A GitHub OAuth App ([GitHub → Settings → Developer settings → OAuth Apps](https://github.com/settings/developers)) with callback URL `http://localhost:3000/api/auth/callback/github`
- Docker, to run [Soketi](https://docs.soketi.app/), a Pusher-compatible server, for live updates in development and in the E2E tests
- For deployments, a Pusher Channels app (free tier is enough)

### Local setup

```bash
git clone https://github.com/Odiethebest/SprintProof.git
cd SprintProof
npm install
cp .env.example .env.local   # then fill in the values
npx prisma migrate dev
npm run dev
```

Open http://localhost:3000.

### Environment variables

| Name | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `DATABASE_CA_CERT` | Vercel only: the Supabase root CA as PEM text, the contents of [`docs/certs/supabase-prod-ca-2021.crt`](docs/certs/supabase-prod-ca-2021.crt). The app then connects over TLS and checks the server certificate and host name against it ([Database connection](#database-connection)). Paste it with its line breaks, or on one line with each line break written as `\n`. Leave empty locally: local Docker and CI connect without TLS. |
| `AUTH_SECRET` | Secret used to sign session JWTs |
| `AUTH_GITHUB_ID` | GitHub OAuth App client ID |
| `AUTH_GITHUB_SECRET` | GitHub OAuth App client secret |
| `AUTH_REDIRECT_PROXY_URL` | Vercel only. Set on Production and Preview to `https://sprintproof.vercel.app/api/auth` so previews sign in through production's GitHub OAuth App; both then need the same `AUTH_SECRET`. Leave empty locally. |
| `GITHUB_WEBHOOK_SECRET` | Verifies incoming GitHub webhook signatures |
| `PUSHER_APP_ID` / `PUSHER_SECRET` | Server-side Pusher credentials. Leave all the Pusher values empty to turn live updates off; pages then update on reload. |
| `NEXT_PUBLIC_PUSHER_KEY` / `NEXT_PUBLIC_PUSHER_CLUSTER` | Client-side Pusher config |
| `NEXT_PUBLIC_PUSHER_HOST` / `NEXT_PUBLIC_PUSHER_PORT` | Local only: a Pusher-compatible server such as Soketi (`localhost`, `6001`). Leave empty on Vercel so the app uses Pusher Channels. |
| `COURSE_STAFF_GITHUB_LOGINS` | Course staff: GitHub logins, comma-separated (case and spaces don't matter), who can create and revoke instructor invite links on any team ([decision 006](docs/decisions/006-instructor-invites-from-course-staff.md)). Empty or unset means nobody; then only instructors already on a team can invite instructors. Remove a login when that person leaves the course, because GitHub logins can be renamed and taken by someone else. |
| `E2E_TEST_AUTH` | Enables the test-only sign-in provider for Playwright. Never set in production. |
| `SUPABASE_PROD_DB_PASSWORD` / `SUPABASE_PREVIEW_DB_PASSWORD` | Local only, for applying migrations by hand ([decision 002](docs/decisions/002-database-hosting.md)): the database passwords of sprintproof-prod and sprintproof-preview, filled into the matching `SUPABASE_*_DB_URL` in place of `[YOUR-PASSWORD]`. The app doesn't read them; don't set them on Vercel. |
| `SUPABASE_PROD_DB_URL` / `SUPABASE_PREVIEW_DB_URL` | Local only, used with the passwords above: each project's Session pooler URI (Connect → Session pooler, port 5432), copied as it is with the `[YOUR-PASSWORD]` placeholder. The app doesn't read them; don't set them on Vercel. |

Never commit real values. [`.env.example`](.env.example) lists names only.

### Instructor invite links

A team lead invites members but can't invite instructors: otherwise a lead could join their own team as an instructor with a second GitHub account and read peer feedback ([decision 006](docs/decisions/006-instructor-invites-from-course-staff.md)). Instructor links come from course staff, the logins in `COURSE_STAFF_GITHUB_LOGINS`, and from instructors already on the team, who find the link in **Settings → Members and invites**.

Course staff don't have to be on the team. To invite a team's instructor:

1. Add your GitHub login to `COURSE_STAFF_GITHUB_LOGINS` (on Vercel, under the project's environment variables, then redeploy).
2. Ask the team lead for the team id: it's in the address of any team page, `/teams/<teamId>/dashboard`.
3. Sign in to SprintProof, open `/api-docs`, and call `POST /api/v1/teams/{teamId}/invites` with `{ "role": "INSTRUCTOR" }` ("Try it out"). The page runs on the same site, so it sends your session; an API token isn't accepted here.
4. Send `/invite/<token>` from the response to the instructor, or open it yourself to join as the instructor. The link expires after 7 days. To revoke it, call `DELETE /api/v1/teams/{teamId}/invites/{inviteId}` with the `id` from the same response.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check |
| `npm test` | Unit tests (Vitest) |
| `npm run test:integration` | Integration tests against a test database |
| `npm run test:e2e` | Playwright end-to-end tests |

---

## GitHub Integration

The team lead connects a repository from **Settings**, then adds a webhook on GitHub pointing at `/api/webhooks/github` with `GITHUB_WEBHOOK_SECRET` as the secret. The settings page walks through the steps.

| Webhook event | Recorded as |
|---|---|
| `push` | `COMMIT` activity from any branch, counted once per commit and credited to the commit author (see [Counting Rules](#counting-rules)) |
| `pull_request` | `PR_OPENED` / `PR_MERGED` activity |
| `pull_request_review` | `REVIEW` activity |

Every delivery is checked before anything is stored:

- `X-Hub-Signature-256` is verified with HMAC-SHA256 over the raw body using `timingSafeEqual`; a mismatch returns 401.
- `X-GitHub-Delivery` is used to deduplicate, so a redelivered event is stored once.
- Activity is attributed by GitHub login mapped to a team member. Bot accounts (logins ending in `[bot]`) are ignored.

If a delivery can't be stored, the endpoint returns 500 and keeps nothing from it. GitHub doesn't redeliver failed deliveries on its own; the lead can redeliver one from the webhook's **Recent Deliveries** tab on GitHub.

The OAuth scopes we request, and why, are recorded in [`docs/decisions/`](docs/decisions/).

---

## Deployment

| Environment | Trigger | Database and env vars |
|---|---|---|
| Preview | Every pull request (Vercel preview deployment) | Separate preview database |
| Production | Every push to `main` (Vercel production deployment). CI runs at the same time and doesn't hold the deployment back; the Database workflow's smoke test then checks that production serves the new commit | Production database |

See [`docs/architecture.md`](docs/architecture.md) for details.

### Database connection

The app reaches Supabase through the Session pooler over TLS, and verifies the pooler's certificate and host name against Supabase's root CA in `DATABASE_CA_CERT`, set on Vercel Production and Preview ([decision 002](docs/decisions/002-database-hosting.md#connecting-over-tls)). It replaces the earlier `PGSSLMODE=no-verify` stopgap, which encrypted the connection without checking the certificate; with `DATABASE_CA_CERT` set, node-postgres ignores `PGSSLMODE`. "Enforce SSL on incoming connections" is on for both Supabase projects.

To set or replace the certificate: Vercel → Project → Settings → Environment Variables, `DATABASE_CA_CERT` for Production and Preview, value pasted from [`docs/certs/supabase-prod-ca-2021.crt`](docs/certs/supabase-prod-ca-2021.crt), then redeploy (a running deployment keeps its old variables). Check that `/api/health` answers ok and that GitHub sign-in works.

While `DATABASE_CA_CERT` holds anything other than PEM certificates, or while `DATABASE_URL` sets `sslmode`, `ssl` or another `ssl*` parameter that node-postgres would use in place of the CA, the database client refuses to load, so every page and route that uses it, `/api/health` included, answers 500; the error in the function logs names the variable or parameter. A certificate that fails verification (for example `SELF_SIGNED_CERT_IN_CHAIN`) makes `/api/health` answer 503 `DATABASE_UNAVAILABLE`. Decision 002 says how to rotate the CA.

### Database migrations

After every push to `main`, the Database workflow (`database.yml`) runs `prisma migrate deploy` on the preview database, then on production, so a migration that fails on preview never reaches production. Each job reads a `DATABASE_URL` secret from the GitHub environment named after its database, `preview` or `production`. Both secrets are set (since Nov 11, 2026), and both environments accept only protected branches, so a workflow on any other branch can't read them. A job whose environment has no secret adds a notice to the run and skips instead of failing.

To replace a secret, for example after a database password change (repo admin, from a checkout of the repo):

```bash
gh secret set DATABASE_URL --env preview       # paste the value at the prompt; it isn't echoed
gh secret set DATABASE_URL --env production
```

Each value is that project's Session pooler URI (Supabase → Connect → Session pooler, port 5432) with the password filled in ([decision 002](docs/decisions/002-database-hosting.md)). Then re-run the latest Database run on `main` (Actions → Database → Re-run all jobs), or wait for the next push.

After the migrations, a smoke test polls `https://sprintproof.vercel.app/api/health` every 15 seconds for up to 10 minutes. It passes once production answers `"status": "ok"` with the pushed commit, or with a later commit that includes it, which shows that Vercel deployed it and that production reaches its database. Otherwise it fails with the last answer it got. `GET /api/health` is public and returns no team data: it runs `SELECT 1` and returns `{ "status": "ok", "commit": "<deployed Git SHA>" }` (`commit` is `null` outside Vercel), or 503 `DATABASE_UNAVAILABLE`.

Supabase pauses a free project after about a week of low activity. To keep both awake, the Database workflow runs `SELECT 1` on both databases daily with those secrets, and the production guard checks production's `/api/health` daily, which needs no secret.

### Continuous integration

| Check | Workflow | Runs on | What it does |
|---|---|---|---|
| Lint and typecheck | `ci.yml` | Every PR and push to `main` | ESLint and `tsc --noEmit` |
| Unit tests | `ci.yml` | After lint and typecheck | Unit tests with coverage, failing below 90% lines, statements and functions or 85% branches in `src/lib/`, with the totals in the job summary. Then integration tests against a PostgreSQL 17 service container, which also fail when no test files are found |
| E2E tests | `ci.yml` | After unit tests | Applies migrations to a PostgreSQL 17 service container, builds with the Pusher settings of a Soketi service container (live updates), then runs every spec in `e2e/` against `next start` with one worker (the specs share one database). The Playwright report is uploaded as an artifact when it fails |
| Production build | `ci.yml` | After E2E tests | `next build` |
| Dependency audit | `ci.yml` | Every PR and push to `main` | `npm audit --audit-level=high`: fails on high or critical advisories |
| Dependency review | `dependency-review.yml` | Every PR | Fails if the PR adds a dependency with a high or critical advisory |
| CodeQL | `codeql.yml` | Every PR, push to `main`, weekly | Code scanning for JavaScript and TypeScript; results under Security → Code scanning |
| Production guard | `production-guard.yml` | Push to `main`, daily, manual | Fails if production's `/api/auth/providers` offers the test sign-in provider (`E2E_TEST_AUTH`). Daily and manual runs also fail unless production's `/api/health` answers ok, which keeps the production database awake. Not run on PRs, so a production outage doesn't block them |
| Database | `database.yml` | Push to `main`, daily, manual | After a push: `prisma migrate deploy` on the preview database, then production, then the production smoke test. Daily and manual: `SELECT 1` on both databases. Jobs without their environment's `DATABASE_URL` secret skip with a notice. See [Database migrations](#database-migrations) |

---

## Testing

```bash
npm test                    # unit tests for src/lib/ (Vitest)
npm test -- --coverage      # the same, failing below the coverage thresholds CI enforces
npm run test:integration    # route handlers against a real PostgreSQL test database
npm run test:e2e            # Playwright user flows + axe accessibility checks
npx vitest run tests/unit/checks/standup-quota.test.ts   # a single test file
```

Before opening a PR, run `npm run lint && npm run typecheck && npm test`.

### Running the tests

The live dashboard specs need Soketi, a Pusher-compatible server, running locally:

```bash
docker run -d --name sprintproof-soketi -p 6001:6001 quay.io/soketi/soketi:1.6-16-debian
docker start sprintproof-soketi   # later runs
```

`playwright.config.ts` points the dev server at it with Soketi's default app credentials (`app-id`, `app-key`, `app-secret`), which aren't secrets. To see live updates in `npm run dev`, put the same values in `.env.local`:

```bash
PUSHER_APP_ID=app-id
PUSHER_SECRET=app-secret
NEXT_PUBLIC_PUSHER_KEY=app-key
NEXT_PUBLIC_PUSHER_CLUSTER=mt1
NEXT_PUBLIC_PUSHER_HOST=localhost
NEXT_PUBLIC_PUSHER_PORT=6001
```

The GitHub activity spec signs its webhook deliveries with `e2e-webhook-secret-not-a-real-secret`, a test value that `playwright.config.ts` also gives the dev server. If Playwright reuses a dev server you started yourself, set `GITHUB_WEBHOOK_SECRET` to the same value there.

Specs that add an instructor sign in as a course staff test user from `e2e/helpers/course-staff.ts`, and `playwright.config.ts` gives the dev server those logins as `COURSE_STAFF_GITHUB_LOGINS`. If Playwright reuses a dev server you started yourself, set `COURSE_STAFF_GITHUB_LOGINS` there to the logins in that file.

We follow red-green-refactor, and the git history shows it: every feature starts with a commit containing only failing tests, followed by the implementation commit.

```
test(checks): add failing tests for standup quota (#7)
feat(checks): implement standup quota check (#7)
refactor(checks): extract sprint date helpers (#7)
```

| Level | Covers | Goal |
|---|---|---|
| Unit | Every function in `src/lib/` | ≥ 90% lines, statements and functions and ≥ 85% branches; CI fails below that |
| Integration | API route handlers with a real database; only GitHub and Pusher wrappers are mocked | Every acceptance criterion |
| E2E | Main user flows in a browser, each with an accessibility check (no serious or critical violations) | Every flow in the PRD |

Overall coverage goal is ≥ 80%. Edge cases we always test: empty sprint, sprint boundary at midnight, member with no GitHub login, bot activity, duplicate webhook delivery.

---

## Counting Rules

These rules define what the dashboard counts. [`AGENTS.md` §1](AGENTS.md) is the source of truth; this is a summary.

### Sprint windows

Each team has a timezone (default `America/Los_Angeles`). Timestamps are stored in UTC, and sprint boundaries are computed in the team timezone: a sprint runs from 00:00 on its start date through 23:59:59.999 on its end date, inclusive. The end is computed as the start of the next day minus 1 ms, so it stays right in timezones where a DST change skips midnight.

### Standups, reviews and commits

| Activity | What counts |
|---|---|
| Standup | At most one per person per calendar day (team timezone), counted on its stored day, never by when it was saved. Editing the same day's standup updates it instead of adding another. A form opened on an earlier day doesn't file under today (409 `STANDUP_DAY_CHANGED`). A standup counts in the sprint whose dates contain its day, so it moves with its day when sprint dates change; one on a day outside every sprint is kept but not counted. |
| Review | Distinct PRs reviewed per member (approved, changes requested, or commented). Three reviews on the same PR count as one. Reviews on your own PR never count. |
| Commit | Read from pushes to any branch and deduplicated by SHA. A commit counts once per author, author date and full message, so the copy a rebase, an amend or a force-push makes under a new SHA doesn't count again. Commits GitHub makes on the default branch (committer `web-flow`: merge commits, rebase-merge and squash copies) don't count; one GitHub makes on another branch, such as "Update branch" on a PR, does ([decision 004](docs/decisions/004-count-each-commit-once.md)). Attributed to the commit author's mapped GitHub login, never the committer or the pusher; commits whose author isn't linked to a GitHub account are skipped. Commits from fork PRs or pushed before the webhook was connected aren't counted. |
| Bot | Activity of every type (commits, opened and merged PRs, reviews) from logins ending in `[bot]` is ignored. |

### Requirement status

| Status | Condition |
|---|---|
| Met | Count ≥ required |
| On track | Not met, sprint still running, more than 2 days left |
| At risk | Not met, sprint still running, 2 or fewer days left |
| Missed | Not met, sprint has ended |

Before a sprint starts there's no status: the sprint summary API returns `null` for an upcoming sprint.

Days left = the sprint's end date minus today's date, both in the team timezone, plus 1 (today counts). With a Nov 4 end: Nov 2 has 3 days left (On track), Nov 3 has 2 (At risk), Nov 4 has 1 (At risk).

Status is always shown with an icon and a text label, never by color alone.

### Retros and peer feedback

Each member gets 3 votes per retro, at most 1 per item. The top 3 "To improve" items by vote count (ties broken by earliest created) become action items for the next sprint. Peer feedback is visible only to users with the instructor role; this is enforced on the server and covered by integration tests, not just hidden in the UI.

---

## Documentation

| Document | Description |
|---|---|
| [`docs/PRD.md`](docs/PRD.md) | Product requirements: problem, user stories, acceptance criteria, out-of-scope list |
| [`docs/architecture.md`](docs/architecture.md) | System design, database schema diagram, deployment details |
| [`docs/api/openapi.yaml`](docs/api/openapi.yaml) | REST API reference for every `/api/v1` endpoint, shown with Swagger UI at `/api-docs` |
| [`DESIGN.md`](DESIGN.md) | Design system: colors, type scale, spacing, component rules |
| [`docs/design/`](docs/design/) | Prototype mockups for each screen |
| [`docs/decisions/`](docs/decisions/) | One record per big technical choice |
| [`docs/sprints/`](docs/sprints/) | Planning notes, standups and retros for each sprint |
| [`AGENTS.md`](AGENTS.md) | Shared rules for humans and AI coding tools: stack, architecture, conventions, workflow |
| [`CLAUDE.md`](CLAUDE.md) | Claude Code-specific notes (imports `AGENTS.md`) |

---

## Implementation Status

| Feature | Status | Notes |
|---|---|---|
| GitHub sign-in and teams | Done | Auth.js GitHub provider, create a team, invite links, lead / member / instructor roles (PRs #37, #44); invite writes serialized (PR #83); instructor links only from course staff and the team's instructors (#116) |
| Repository connection and webhooks | Done | Signature verification, delivery dedup, idempotent `Activity` storage, webhook URL and setup steps in Settings (PRs #49, #79, #83). One app-wide webhook secret for now: per-team secret rotation and the "Unmapped activity" list aren't built (#78) |
| Sprints and requirements | Done | Create and edit sprints with dates, standups and PR reviews per person; date, overlap and 1–20 checks (PRs #40, #47); overlapping writes serialized (PR #83) |
| Async standups | Done | Three-question form, one per person per day in the team timezone, history by day (PRs #51, #69, #81); character counter and focus fixes (PRs #84, #85) |
| Live contribution dashboard | Done | Counts per member, activity feed, Pusher live updates (PRs #58, #60, #80); teammates' standups announced to screen readers (PR #85); reviews say "approved", "requested changes on" or "commented on" #N (#57) |
| Requirement checks | Done | Met / On track / At risk / Missed in `src/lib/checks/` (PR #30), shown on the dashboard (PR #58) |
| Retros and action items | Done | Retro page per sprint: the lead opens and closes it, members add items and vote (3 each, 1 per item), and the top 3 "To improve" items are carried into the next sprint, where they get done checkboxes (#13) |
| Peer feedback | Planned | Instructor-only, enforced on the server (#14) |
| Instructor view and Markdown export | Partly done | Read-only review page at `/review/[teamId]` for leads and instructors: requirements per member with status, standups by day, and a `sprint-N-summary.md` export (preview, copy, download) in the `docs/sprints/` style (PR #108). The retro, with vote counts and the next sprint's action items, is on the page and in the export (#13). Instructor-only peer feedback waits on #14; until then the page and the export say it isn't recorded yet |
| Public REST API | Done | Personal tokens stored as SHA-256 hashes; read-only Bearer access to sprints, sprint summaries and standups; cursor pagination; Swagger UI at `/api-docs` (PRs #64, #65, #66); inputs that used to return 500 are rejected (PR #82); team listing (`GET /teams`, and `GET /teams/{teamId}` with its members) and 500 `INTERNAL_ERROR` in the same error shape for unexpected errors (#97) |

---

## Demo & Links

- **Production:** https://sprintproof.vercel.app
- **Demo video:** _coming soon_
- **API docs:** https://sprintproof.vercel.app/api-docs (source: [`docs/api/openapi.yaml`](docs/api/openapi.yaml))

---

## License

MIT. See [LICENSE](LICENSE).
