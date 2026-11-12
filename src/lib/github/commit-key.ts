import crypto from "node:crypto";

export interface CommitIdentity {
  authorName: string;
  authorEmail: string;
  authorDate: Date;
  message: string;
}

// Counting rule: a commit counts once per author, author date and full message
// (AGENTS.md §1, decision 004). A rebase, an amend that keeps the message or a
// force-push copies all three to a new SHA, so the copy gets the same key.
// Hashed, because a full message can be longer than an index entry allows.
// GitHub's push payload drops the newline git ends a message with, and rows
// stored before #114 get their key from git, so the end is trimmed.
// Self-contained (no `@/` imports) so scripts/backfill-commit-keys.mjs can run it.
export function toCommitKey({
  authorName,
  authorEmail,
  authorDate,
  message,
}: CommitIdentity): string {
  const identity = JSON.stringify([
    authorName,
    authorEmail,
    authorDate.toISOString(),
    message.trimEnd(),
  ]);
  return crypto.createHash("sha256").update(identity).digest("hex");
}
