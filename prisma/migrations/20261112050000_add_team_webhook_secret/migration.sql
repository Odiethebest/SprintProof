-- Each team gets its own webhook secret (decision 005, #115). The app makes a
-- new team's secret with crypto.randomBytes(32) as 64 hex characters.
--
-- Teams that already exist get theirs here. gen_random_uuid() is built into
-- PostgreSQL 13 and later (no extension needed) and draws from the server's
-- cryptographically strong random source (pg_strong_random). Two of them,
-- without the dashes, are 64 hex characters with 244 random bits. The lead
-- copies the secret from Settings or rotates it there.

-- AlterTable
ALTER TABLE "teams" ADD COLUMN "webhook_secret" TEXT;
UPDATE "teams"
SET "webhook_secret" = replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
ALTER TABLE "teams" ALTER COLUMN "webhook_secret" SET NOT NULL;

-- Teams connected before this change have a GitHub webhook signed with the
-- server-wide GITHUB_WEBHOOK_SECRET, so they keep accepting it (true) until
-- GitHub sends a delivery signed with their own secret. New teams never
-- accept it (the default, false).

-- AlterTable
ALTER TABLE "teams" ADD COLUMN "can_use_server_webhook_secret" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "teams" ALTER COLUMN "can_use_server_webhook_secret" SET DEFAULT false;
