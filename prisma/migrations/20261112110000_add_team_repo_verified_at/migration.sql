-- Decision 007 (#117): a team's repository is pending until GitHub delivers a
-- ping signed with the team's own webhook secret. repo_verified_at is when
-- that happened; it stays null while the connection is pending. Only a
-- verified team's deliveries count.

-- AlterTable
ALTER TABLE "teams" ADD COLUMN "repo_verified_at" TIMESTAMP(3);

-- Teams that already received a verified delivery count as verified, so
-- connected repositories keep working. Only a delivery with a valid signature
-- is stored with a team, and only such a delivery ever stored a team's
-- repo_id (#11), so either one shows the team is connected. A team counts as
-- verified from its first stored delivery, or from now when none is stored.
-- Teams with neither stay pending.
UPDATE "teams"
SET "repo_verified_at" = COALESCE(
  (
    SELECT min("webhook_deliveries"."delivered_at")
    FROM "webhook_deliveries"
    WHERE "webhook_deliveries"."team_id" = "teams"."id"
  ),
  CURRENT_TIMESTAMP
)
WHERE "repo_id" IS NOT NULL
  OR EXISTS (
    SELECT 1
    FROM "webhook_deliveries"
    WHERE "webhook_deliveries"."team_id" = "teams"."id"
  );

-- Any number of teams can now have one repository pending, in any letter
-- case, so neither unique index on the name can stay: the Prisma schema's
-- case-sensitive @unique (teams_repo_full_name_key, #7) and #94's index on
-- lower(repo_full_name). Dropping a unique index never fails on existing data.

-- DropIndex
DROP INDEX "teams_repo_full_name_lower_key";

-- DropIndex
DROP INDEX "teams_repo_full_name_key";

-- At most one verified team per repository, ignoring case. Pending teams
-- aren't in the index. It can't fail here: until this migration the index on
-- lower(repo_full_name) allowed one team per name in the first place. The
-- Prisma schema can't express a partial index on an expression, so it lives
-- here as raw SQL.

-- CreateIndex
CREATE UNIQUE INDEX "teams_verified_repo_full_name_lower_key" ON "teams"(lower("repo_full_name")) WHERE "repo_verified_at" IS NOT NULL;
