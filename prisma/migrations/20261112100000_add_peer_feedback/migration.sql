-- Partner feedback (#14). A new table only, so existing rows are untouched.

-- CreateTable
CREATE TABLE "peer_feedback" (
    "id" TEXT NOT NULL,
    "sprint_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "recipient_id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "peer_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "peer_feedback_author_id_idx" ON "peer_feedback"("author_id");

-- CreateIndex
CREATE INDEX "peer_feedback_recipient_id_idx" ON "peer_feedback"("recipient_id");

-- CreateIndex
CREATE UNIQUE INDEX "peer_feedback_sprint_id_author_id_recipient_id_key" ON "peer_feedback"("sprint_id", "author_id", "recipient_id");

-- AddForeignKey
ALTER TABLE "peer_feedback" ADD CONSTRAINT "peer_feedback_sprint_id_fkey" FOREIGN KEY ("sprint_id") REFERENCES "sprints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "peer_feedback" ADD CONSTRAINT "peer_feedback_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "peer_feedback" ADD CONSTRAINT "peer_feedback_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
