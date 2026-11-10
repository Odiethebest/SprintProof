-- A standup belongs to its team and day. Its sprint is the one whose dates
-- contain that day, so editing sprint dates can't leave it in the wrong one (#56).

-- AddColumn: each standup's team is the team of the sprint it was filed under.
ALTER TABLE "standups" ADD COLUMN "team_id" TEXT;

UPDATE "standups"
SET "team_id" = "sprints"."team_id"
FROM "sprints"
WHERE "sprints"."id" = "standups"."sprint_id";

ALTER TABLE "standups" ALTER COLUMN "team_id" SET NOT NULL;

-- DropForeignKey
ALTER TABLE "standups" DROP CONSTRAINT "standups_sprint_id_fkey";

-- DropIndex
DROP INDEX "standups_sprint_id_idx";

-- DropIndex
DROP INDEX "standups_sprint_id_user_id_date_key";

-- AlterTable
ALTER TABLE "standups" DROP COLUMN "sprint_id";

-- CreateIndex
CREATE INDEX "standups_team_id_date_idx" ON "standups"("team_id", "date");

-- CreateIndex: fails if someone already has two standups on one day in a team,
-- which the old per-sprint key allowed after a day moved to another sprint.
CREATE UNIQUE INDEX "standups_team_id_user_id_date_key" ON "standups"("team_id", "user_id", "date");

-- AddForeignKey
ALTER TABLE "standups" ADD CONSTRAINT "standups_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
