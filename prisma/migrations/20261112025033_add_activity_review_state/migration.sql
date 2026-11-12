-- #57: GitHub's review.state for REVIEW activities. Nullable with no default,
-- so adding it doesn't rewrite the table, and rows stored before this change
-- keep NULL: the activity feed shows them as "reviewed #N" and they still count.

-- CreateEnum
CREATE TYPE "ReviewState" AS ENUM ('APPROVED', 'CHANGES_REQUESTED', 'COMMENTED');

-- AlterTable
ALTER TABLE "activities" ADD COLUMN     "review_state" "ReviewState";
