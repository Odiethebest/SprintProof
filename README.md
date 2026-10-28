# SprintProof: Async Scrum Log for Student Teams

> Standups, sprint planning and retros in one place, GitHub activity synced automatically, and a clear record of who did what. Your sprint, on the record.

[![CI](https://github.com/Odiethebest/SprintProof/actions/workflows/ci.yml/badge.svg)](https://github.com/Odiethebest/SprintProof/actions/workflows/ci.yml)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql)](https://www.postgresql.org/)
[![TDD](https://img.shields.io/badge/Test--Driven%20Development-C21325)](#testing)
[![DDD](https://img.shields.io/badge/Domain--Driven%20Design-6E40C9)](#counting-rules)
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

1. **Sign in and connect.** Sign in with GitHub, create a team or join with an invite link. The team lead connects the repository and adds the webhook.
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
| Ziqi (Odie) Yang | [@Odiethebest](https://github.com/Odiethebest) | _Set at Sprint 1 planning_ |
| Yunhong Huang | [@santiaojun](https://github.com/santiaojun) | _Set at Sprint 1 planning_ |

Every task is a GitHub Issue on the project board (Backlog → Sprint Todo → In Progress → In Review → Done). Each issue gets its own branch (`feature/12-standup-form`, `fix/31-webhook-signature`), commits follow [Conventional Commits](https://www.conventionalcommits.org/) ending with the issue number, and every pull request needs CI passing plus an approving review from the other partner. No one merges their own PR, and we never squash-merge, because squashing erases the test-first commits. AI coding tools follow the same rules and commit or push only when the developer explicitly asks, under that developer's own git identity, so authorship in the git history stays accurate.

| Sprint | Dates | Milestone |
|---|---|---|
| Sprint 1 | Oct 29 – Nov 4, 2026 | "Sprint 1" |
| Sprint 2 | Nov 5 – Nov 11, 2026 | "Sprint 2" |

Planning notes, standups and retros live in [`docs/sprints/`](docs/sprints/). For the full conventions shared by humans and AI tools (branching, commits, PRs, coding standards, security), see [`AGENTS.md`](AGENTS.md). Contribution log: _added at the end of Sprint 2_.

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
│   ├── workflows/ci.yml
│   ├── ISSUE_TEMPLATE/
│   └── pull_request_template.md
├── .agents/ .cursor/ .claude/        # tool-specific scoped rules and skills only
├── docs/
│   ├── PRD.md                        # problem, user stories, acceptance criteria
│   ├── architecture.md               # system design + database schema diagram
│   ├── api/openapi.yaml              # public REST API reference
│   ├── decisions/                    # one record per big technical choice
│   ├── research/
│   ├── design/                       # prototype mockups
│   └── sprints/
│       ├── sprint-1/                 # planning.md, standups.md, retro.md
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
│   │   ├── db.ts                     # single Prisma client
│   │   ├── repositories/             # all database reads/writes
│   │   ├── auth.ts                   # session helpers, requireTeamRole()
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
- A Pusher Channels app (free tier is enough)

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
| `AUTH_SECRET` | Secret used to sign session JWTs |
| `AUTH_GITHUB_ID` | GitHub OAuth App client ID |
| `AUTH_GITHUB_SECRET` | GitHub OAuth App client secret |
| `GITHUB_WEBHOOK_SECRET` | Verifies incoming GitHub webhook signatures |
| `PUSHER_APP_ID` / `PUSHER_SECRET` | Server-side Pusher credentials |
| `NEXT_PUBLIC_PUSHER_KEY` / `NEXT_PUBLIC_PUSHER_CLUSTER` | Client-side Pusher config |
| `E2E_TEST_AUTH` | Enables the test-only sign-in provider for Playwright. Never set in production. |

Never commit real values. [`.env.example`](.env.example) lists names only.

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
| `push` | `COMMIT` activity, deduplicated by SHA |
| `pull_request` | `PR_OPENED` / `PR_MERGED` activity; commits are also read from the PR's commit list so merges don't hide authorship |
| `pull_request_review` | `REVIEW` activity |

Every delivery is checked before anything is stored:

- `X-Hub-Signature-256` is verified with HMAC-SHA256 over the raw body using `timingSafeEqual`; a mismatch returns 401.
- `X-GitHub-Delivery` is used to deduplicate, so a redelivered event is stored once.
- Activity is attributed by GitHub login mapped to a team member. Bot accounts (logins ending in `[bot]`) are ignored.

The OAuth scopes we request, and why, are recorded in [`docs/decisions/`](docs/decisions/).

---

## Deployment

| Environment | Trigger | Database and env vars |
|---|---|---|
| Preview | Every pull request (Vercel preview deployment) | Separate preview database |
| Production | Merge to `main`, after CI passes | Production database |

See [`docs/architecture.md`](docs/architecture.md) for details.

---

## Testing

```bash
npm test                    # unit tests for src/lib/ (Vitest)
npm run test:integration    # route handlers against a real PostgreSQL test database
npm run test:e2e            # Playwright user flows + axe accessibility checks
npx vitest run tests/unit/checks/standup-quota.test.ts   # a single test file
```

Before opening a PR, run `npm run lint && npm run typecheck && npm test`.

We follow red-green-refactor, and the git history shows it: every feature starts with a commit containing only failing tests, followed by the implementation commit.

```
test(checks): add failing tests for standup quota (#7)
feat(checks): implement standup quota check (#7)
refactor(checks): extract sprint date helpers (#7)
```

| Level | Covers | Goal |
|---|---|---|
| Unit | Every function in `src/lib/` | ≥ 90% line coverage |
| Integration | API route handlers with a real database; only GitHub and Pusher wrappers are mocked | Every acceptance criterion |
| E2E | Main user flows in a browser, each with an accessibility check (no serious or critical violations) | Every flow in the PRD |

Overall coverage goal is ≥ 80%. Edge cases we always test: empty sprint, sprint boundary at midnight, member with no GitHub login, bot activity, duplicate webhook delivery.

---

## Counting Rules

These rules define what the dashboard counts. [`AGENTS.md` §1](AGENTS.md) is the source of truth; this is a summary.

### Sprint windows

Each team has a timezone (default `America/Los_Angeles`). Timestamps are stored in UTC, and sprint boundaries are computed in the team timezone: a sprint runs from 00:00 on its start date through 23:59:59.999 on its end date, inclusive.

### Standups, reviews and commits

| Activity | What counts |
|---|---|
| Standup | At most one per person per calendar day (team timezone). Editing the same day's standup updates it instead of adding another. |
| Review | Distinct PRs reviewed per member (approved, changes requested, or commented). Three reviews on the same PR count as one. Reviews on your own PR never count. |
| Commit | Deduplicated by SHA, attributed by mapped GitHub login, read from PR commit lists as well as the default branch. Bots are ignored. |

### Requirement status

| Status | Condition |
|---|---|
| Met | Count ≥ required |
| On track | Not met, sprint still running, more than 2 days left |
| At risk | Not met, sprint still running, 2 or fewer days left |
| Missed | Not met, sprint has ended |

Status is always shown with an icon and a text label, never by color alone.

### Retros and peer feedback

Each member gets 3 votes per retro, at most 1 per item. The top 3 "To improve" items by vote count (ties broken by earliest created) become action items for the next sprint. Peer feedback is visible only to users with the instructor role; this is enforced on the server and covered by integration tests, not just hidden in the UI.

---

## Documentation

| Document | Description |
|---|---|
| [`docs/PRD.md`](docs/PRD.md) | Product requirements: problem, user stories, acceptance criteria, out-of-scope list |
| [`docs/architecture.md`](docs/architecture.md) | System design, database schema diagram, deployment details |
| [`docs/api/openapi.yaml`](docs/api/openapi.yaml) | Public REST API reference (sprint summaries, standups) |
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
| GitHub sign-in and teams | Planned | Auth.js GitHub provider, invite links, lead / member / instructor roles |
| Repository connection and webhooks | Planned | Signature verification, idempotent `Activity` storage |
| Async standups | Planned | Three-question form, one per person per day |
| Live contribution dashboard | Planned | Counts per member, Pusher live updates |
| Requirement checks | Planned | Met / On track / At risk / Missed |
| Retros and action items | Planned | Voting, top 3 "To improve" items carried into the next sprint |
| Peer feedback | Planned | Instructor-only, enforced on the server |
| Instructor view and Markdown export | Planned | Read-only review page, `sprint-N-summary.md` download |
| Public REST API | Planned | Bearer tokens, stored as SHA-256 hashes |

---

## Demo & Links

- **Production:** _coming soon_
- **Demo video:** _coming soon_
- **API docs:** [`docs/api/openapi.yaml`](docs/api/openapi.yaml)

---

## License

MIT. See [LICENSE](LICENSE).
