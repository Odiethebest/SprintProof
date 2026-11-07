-- AlterTable
ALTER TABLE "teams" ADD COLUMN     "repo_id" BIGINT;

-- CreateTable
CREATE TABLE "webhook_deliveries" (
    "id" TEXT NOT NULL,
    "team_id" TEXT,
    "event" TEXT NOT NULL,
    "delivered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "teams_repo_id_key" ON "teams"("repo_id");

-- CreateIndex
CREATE INDEX "webhook_deliveries_team_id_idx" ON "webhook_deliveries"("team_id");

-- AddForeignKey
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
