-- AlterTable
ALTER TABLE "teams" ADD COLUMN     "repo_full_name" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "invites" (
    "id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "role" "MembershipRole" NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invites_token_key" ON "invites"("token");

-- CreateIndex
CREATE INDEX "invites_team_id_idx" ON "invites"("team_id");

-- CreateIndex
CREATE UNIQUE INDEX "teams_repo_full_name_key" ON "teams"("repo_full_name");

-- AddForeignKey
ALTER TABLE "invites" ADD CONSTRAINT "invites_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

