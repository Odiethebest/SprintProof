# Architecture & Database Schema

SprintProof is an async Scrum log and contribution tracker for student software teams.

## Layering Architecture

The application enforces one-way layering: `app/` → `server/` → `lib/`.

- **`src/app/`**: Next.js App Router pages, layouts, and route handlers. Validates input with Zod, checks authorization, and invokes `server/` repositories.
- **`src/server/`**: Side effects, database interactions via Prisma Client (`src/server/db.ts`), GitHub client wrappers, and Pusher realtime triggers.
- **`src/lib/`**: Pure business logic with no I/O, no database imports, and deterministic inputs/outputs.
- **`src/types/`**: Shared TypeScript definitions.

## Database Schema (Prisma 7)

PostgreSQL database models managed via Prisma schema (`prisma/schema.prisma`). All models use PascalCase singular naming and map to snake_case plural tables using `@@map`.

### Entity-Relationship Diagram

```mermaid
erDiagram
  User ||--o{ Membership : has
  User ||--o{ Standup : submits
  Team ||--o{ Membership : has
  Team ||--o{ Sprint : plans
  Team ||--o{ Activity : tracks
  Team ||--o{ Invite : issues
  Sprint ||--o{ Standup : contains

  User {
    string id PK "cuid"
    string githubId UK "github_id"
    string githubLogin UK "github_login, nullable"
    string name
    string avatarUrl "avatar_url"
    datetime createdAt "created_at"
    datetime updatedAt "updated_at"
  }

  Team {
    string id PK "cuid"
    string name
    string repoFullName UK "repo_full_name (owner/name)"
    string timezone "default America/Los_Angeles"
    datetime createdAt "created_at"
    datetime updatedAt "updated_at"
  }

  Membership {
    string id PK "cuid"
    enum role "LEAD | MEMBER | INSTRUCTOR"
    string userId FK "user_id"
    string teamId FK "team_id"
    datetime createdAt "created_at"
    datetime updatedAt "updated_at"
  }

  Invite {
    string id PK "cuid"
    string teamId FK "team_id"
    enum role "MEMBER | INSTRUCTOR"
    string token UK "random, base64url"
    datetime expiresAt "expires_at (7 days after creation)"
    datetime revokedAt "revoked_at, nullable"
    datetime createdAt "created_at"
    datetime updatedAt "updated_at"
  }

  Sprint {
    string id PK "cuid"
    string teamId FK "team_id"
    string name
    date startDate "start_date (@db.Date)"
    date endDate "end_date (@db.Date)"
    int standupsPerPerson "standups_per_person (default 3)"
    int reviewsPerPerson "reviews_per_person (default 5)"
    datetime createdAt "created_at"
    datetime updatedAt "updated_at"
  }

  Standup {
    string id PK "cuid"
    string sprintId FK "sprint_id"
    string userId FK "user_id"
    date date "calendar day in team timezone (@db.Date)"
    string yesterday
    string today
    string blockers "optional"
    datetime createdAt "created_at"
    datetime updatedAt "updated_at"
  }

  Activity {
    string id PK "cuid"
    string teamId FK "team_id"
    enum type "COMMIT | PR_OPENED | PR_MERGED | REVIEW"
    string actorLogin "actor_login"
    int prNumber "pr_number"
    string prAuthorLogin "pr_author_login"
    string sha "optional commit sha"
    string title "optional"
    datetime occurredAt "occurred_at (timestamp on GitHub)"
    datetime createdAt "created_at (row insertion time)"
    datetime updatedAt "updated_at"
  }
```

### Table Mappings & Key Constraints

- **`users` (`User`)**: `github_id` is required and unique. `github_login` is unique but nullable: after a GitHub rename the login can move to another account, and the previous holder's login is cleared until they sign in again (#6). No email column (`docs/decisions/001-github-oauth-scopes.md`).
- **`teams` (`Team`)**: Holds the connected GitHub repo (`repo_full_name`, GitHub's `owner/name`, unique so a webhook delivery maps to one team) and the team timezone (`timezone`, default `America/Los_Angeles`).
- **`invites` (`Invite`)**: Invite links. `role` is `MEMBER` or `INSTRUCTOR`; a link works until `expires_at` (7 days after creation) unless `revoked_at` is set. At most one active link per team and role: creating a new one revokes the previous one. `token` is stored as is rather than hashed so the lead can copy the link again from Settings (#7).
- **`memberships` (`Membership`)**: Join model between `User` and `Team` with `role` (`LEAD`, `MEMBER`, `INSTRUCTOR`). Compound unique constraint on `[user_id, team_id]`.
- **`sprints` (`Sprint`)**: Calendar boundaries stored as `@db.Date` (`start_date`, `end_date`), along with `standups_per_person` and `reviews_per_person`.
- **`standups` (`Standup`)**: Calendar day stored as `@db.Date` (`date`) in team timezone with compound unique constraint `@@unique([sprint_id, user_id, date])` ensuring at most one standup per person per day.
- **`activities` (`Activity`)**: Activity records with `occurred_at` for event time and `@@unique([team_id, type, sha])` deduplicating commit SHAs.
