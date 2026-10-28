## Summary
Create the database schema and connection so feature work can read and write data.

## Acceptance criteria
- [ ] `prisma/schema.prisma` defines at least `User`, `Team`, `Membership`, `Sprint`, `Standup`, `Activity` (other models are added by their feature issues)
- [ ] Models are PascalCase singular; tables mapped to snake_case plural with `@@map`
- [ ] Initial migration committed
- [ ] `src/server/db.ts` exports a single Prisma client (safe for Next.js hot reload)
- [ ] Integration test setup resets a test database between test files
- [ ] `docs/architecture.md` contains a Mermaid `erDiagram` of the schema

**Estimate:** 3 points
**PRD:** §6 Business rules
**Depends on:** #3
