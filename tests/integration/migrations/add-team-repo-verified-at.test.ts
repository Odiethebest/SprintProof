import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { insertTeam, insertWebhookDelivery } from "../../factories/db";
import { clearDatabase } from "../setup/test-setup";

// Decision 007 (#117): teams that already received a verified delivery count
// as verified once the migration runs, so connected repositories keep
// working. Production's only team has received deliveries.
const MIGRATION_SQL = fs.readFileSync(
  path.resolve(
    process.cwd(),
    "prisma/migrations/20261112110000_add_team_repo_verified_at/migration.sql"
  ),
  "utf8"
);

// Puts the schema back the way it was before the migration. Runs inside a
// transaction that's rolled back, so the test database keeps its schema.
const UNDO_MIGRATION = [
  `DROP INDEX "teams_verified_repo_full_name_lower_key"`,
  `ALTER TABLE "teams" DROP COLUMN "repo_verified_at"`,
  `CREATE UNIQUE INDEX "teams_repo_full_name_key" ON "teams"("repo_full_name")`,
  `CREATE UNIQUE INDEX "teams_repo_full_name_lower_key" ON "teams"(lower("repo_full_name"))`,
];

// The migration's statements, without its comments.
function statementsOf(sql: string): string[] {
  return sql
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n")
    .split(/;\s*(?:\n|$)/)
    .map((statement) => statement.trim())
    .filter((statement) => statement !== "");
}

class RollBack extends Error {}

// Runs the migration on the teams and deliveries stored now, as if they were
// stored before it, and returns each team's repo_verified_at afterwards.
async function migrateStoredTeams(): Promise<Map<string, Date | null>> {
  let verifiedAt = new Map<string, Date | null>();
  try {
    await db.$transaction(async (tx) => {
      for (const statement of UNDO_MIGRATION) {
        await tx.$executeRawUnsafe(statement);
      }
      for (const statement of statementsOf(MIGRATION_SQL)) {
        await tx.$executeRawUnsafe(statement);
      }
      const rows = await tx.$queryRaw<
        { id: string; repoVerifiedAt: Date | null }[]
      >`SELECT "id", "repo_verified_at" AS "repoVerifiedAt" FROM "teams"`;
      verifiedAt = new Map(rows.map((row) => [row.id, row.repoVerifiedAt]));
      throw new RollBack();
    });
  } catch (error) {
    if (!(error instanceof RollBack)) {
      throw error;
    }
  }
  return verifiedAt;
}

describe("migration 20261112110000_add_team_repo_verified_at", () => {
  beforeEach(clearDatabase);

  it("counts a team that already received a verified delivery as verified, from its first delivery", async () => {
    // Arrange: production's case, a connected team with deliveries
    const team = await insertTeam({ repoId: 987654321n });
    await insertWebhookDelivery({
      id: "first-ping",
      teamId: team.id,
      event: "ping",
      deliveredAt: new Date("2026-11-02T10:00:00Z"),
    });
    await insertWebhookDelivery({
      id: "later-push",
      teamId: team.id,
      event: "push",
      deliveredAt: new Date("2026-11-09T18:30:00Z"),
    });

    // Act
    const verifiedAt = await migrateStoredTeams();

    // Assert
    expect(verifiedAt.get(team.id)).toEqual(new Date("2026-11-02T10:00:00Z"));
  });

  it("counts a team with a stored delivery as verified even when it has no repository id", async () => {
    // Arrange
    const team = await insertTeam({ repoId: null });
    await insertWebhookDelivery({
      id: "push-without-repo-id",
      teamId: team.id,
      event: "push",
      deliveredAt: new Date("2026-11-05T09:00:00Z"),
    });

    // Act
    const verifiedAt = await migrateStoredTeams();

    // Assert
    expect(verifiedAt.get(team.id)).toEqual(new Date("2026-11-05T09:00:00Z"));
  });

  // Only a verified delivery ever stored a team's repository id (#11).
  it("counts a team with a repository id as verified even when no delivery of it is stored", async () => {
    // Arrange
    const team = await insertTeam({ repoId: 123n });

    // Act
    const verifiedAt = await migrateStoredTeams();

    // Assert
    expect(verifiedAt.get(team.id)).toBeInstanceOf(Date);
  });

  it("leaves a team that never received a delivery pending", async () => {
    // Arrange: and a ping kept without a team, which verifies nobody
    const team = await insertTeam({ repoId: null });
    await insertWebhookDelivery({
      id: "ping-without-team",
      teamId: null,
      event: "ping",
    });

    // Act
    const verifiedAt = await migrateStoredTeams();

    // Assert
    expect(verifiedAt.has(team.id)).toBe(true);
    expect(verifiedAt.get(team.id)).toBeNull();
  });

  it("verifies every connected team and only those, whatever else is stored", async () => {
    // Arrange
    const connected = await insertTeam({ repoId: 1n });
    await insertWebhookDelivery({
      id: "connected-ping",
      teamId: connected.id,
      event: "ping",
    });
    const pending = await insertTeam({ repoId: null });
    const otherConnected = await insertTeam({ repoId: 2n });

    // Act
    const verifiedAt = await migrateStoredTeams();

    // Assert
    expect(verifiedAt.get(connected.id)).toBeInstanceOf(Date);
    expect(verifiedAt.get(otherConnected.id)).toBeInstanceOf(Date);
    expect(verifiedAt.get(pending.id)).toBeNull();
  });
});
