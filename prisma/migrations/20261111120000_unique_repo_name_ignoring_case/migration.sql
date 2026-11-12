-- GitHub repository names ignore case, so "Org/Repo" and "org/repo" are one
-- repo and only one team may connect it (#75). The advisory lock and the
-- case-insensitive check in createTeamWithLead() enforce that in the app; this
-- index enforces it in the database too (#94). The Prisma schema can't express
-- an index on an expression, so it lives here as raw SQL.
--
-- Fails if two teams already have repo names that differ only in case. Find
-- them with:
--   SELECT lower("repo_full_name"), count(*) FROM "teams"
--   GROUP BY 1 HAVING count(*) > 1;
--
-- "teams_repo_full_name_key" stays: the Prisma schema declares it (@unique),
-- so dropping it would leave the schema and the database disagreeing.

-- CreateIndex
CREATE UNIQUE INDEX "teams_repo_full_name_lower_key" ON "teams"(lower("repo_full_name"));
