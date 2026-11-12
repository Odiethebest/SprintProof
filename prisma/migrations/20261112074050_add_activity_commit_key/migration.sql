-- Count each commit once across rebases (#114, decision 004). Additive: every
-- existing row gets NULL, and PostgreSQL treats NULLs as distinct in a unique
-- index, so existing commits keep being deduplicated by SHA only until their
-- keys are filled in (see the PR for #114).

-- AlterTable
ALTER TABLE "activities" ADD COLUMN     "commit_key" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "activities_team_id_commit_key_key" ON "activities"("team_id", "commit_key");
