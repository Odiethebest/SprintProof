import type { Prisma } from "@/generated/prisma/client";

// The first number of a two-number advisory lock: one per kind of write. A
// hashtext() collision between two ids can then only make writes of the same
// kind wait for each other, never a sprint edit wait for an invite (#94).
// Sprint creates and edits share a kind: they must wait for each other.
export const REPO_CLAIM_LOCK = 1;
export const TEAM_INVITES_LOCK = 2;
export const TEAM_SPRINTS_LOCK = 3;
// A sprint's retro: items, votes, closing it and its carried action items
// (#13), and its partner feedback (#14).
export const SPRINT_RETRO_LOCK = 4;

type WriteLockKind =
  | typeof REPO_CLAIM_LOCK
  | typeof TEAM_INVITES_LOCK
  | typeof TEAM_SPRINTS_LOCK
  | typeof SPRINT_RETRO_LOCK;

// Waits until no other transaction holds the lock for this kind and id, then
// holds it until the transaction commits or rolls back.
export async function lockForWrite({
  tx,
  kind,
  id,
}: {
  tx: Prisma.TransactionClient;
  kind: WriteLockKind;
  id: string;
}): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${kind}::integer, hashtext(${id}))`;
}
