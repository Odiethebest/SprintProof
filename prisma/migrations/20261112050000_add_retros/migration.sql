-- Retros with voting and action items (#13). New tables only, so existing
-- rows are untouched.

-- CreateEnum
CREATE TYPE "RetroColumn" AS ENUM ('WENT_WELL', 'TO_IMPROVE');

-- CreateTable
CREATE TABLE "retros" (
    "id" TEXT NOT NULL,
    "sprint_id" TEXT NOT NULL,
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "retros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retro_items" (
    "id" TEXT NOT NULL,
    "retro_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "column" "RetroColumn" NOT NULL,
    "text" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "retro_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retro_votes" (
    "id" TEXT NOT NULL,
    "item_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "retro_votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "action_items" (
    "id" TEXT NOT NULL,
    "sprint_id" TEXT NOT NULL,
    "retro_item_id" TEXT NOT NULL,
    "is_done" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "action_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "retros_sprint_id_key" ON "retros"("sprint_id");

-- CreateIndex
CREATE INDEX "retro_items_retro_id_idx" ON "retro_items"("retro_id");

-- CreateIndex
CREATE INDEX "retro_items_author_id_idx" ON "retro_items"("author_id");

-- CreateIndex
CREATE INDEX "retro_votes_user_id_idx" ON "retro_votes"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "retro_votes_item_id_user_id_key" ON "retro_votes"("item_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "action_items_retro_item_id_key" ON "action_items"("retro_item_id");

-- CreateIndex
CREATE INDEX "action_items_sprint_id_idx" ON "action_items"("sprint_id");

-- AddForeignKey
ALTER TABLE "retros" ADD CONSTRAINT "retros_sprint_id_fkey" FOREIGN KEY ("sprint_id") REFERENCES "sprints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retro_items" ADD CONSTRAINT "retro_items_retro_id_fkey" FOREIGN KEY ("retro_id") REFERENCES "retros"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retro_items" ADD CONSTRAINT "retro_items_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retro_votes" ADD CONSTRAINT "retro_votes_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "retro_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retro_votes" ADD CONSTRAINT "retro_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_sprint_id_fkey" FOREIGN KEY ("sprint_id") REFERENCES "sprints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "action_items" ADD CONSTRAINT "action_items_retro_item_id_fkey" FOREIGN KEY ("retro_item_id") REFERENCES "retro_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
