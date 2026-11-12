// Real second writers for tests of the advisory locks in the repositories.
// Integration tests mock only the external service wrappers (AGENTS.md §1
// Testing), so these hold rows and tables in an open transaction instead.
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { createInvite } from "@/server/repositories/invites";

const WAIT_TIMEOUT_MS = 5000;
const POLL_INTERVAL_MS = 10;
// How long a write gets to finish while another write holds its lock. A write
// that isn't held up takes a few milliseconds.
const HOLD_MS = 2000;

async function backendPid(tx: Prisma.TransactionClient): Promise<number> {
  const [{ pid }] = await tx.$queryRaw<{ pid: number }[]>`
    SELECT pg_backend_pid() AS pid`;
  return pid;
}

async function countBackendsBlockedBy(pid: number): Promise<number> {
  const [row] = await db.$queryRaw<{ blocked: number }[]>`
    SELECT count(*)::int AS blocked
    FROM pg_stat_activity
    WHERE ${pid}::int = ANY(pg_blocking_pids(pid))`;
  return row.blocked;
}

async function waitUntil({
  condition,
  message,
}: {
  condition: () => Promise<boolean>;
  message: string;
}): Promise<void> {
  const deadline = Date.now() + WAIT_TIMEOUT_MS;
  while (!(await condition())) {
    if (Date.now() > deadline) {
      throw new Error(message);
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

interface Tracked<T> {
  promise: Promise<T>;
  hasSettled: boolean;
}

// Starts `run` and notes when it settles. The caller awaits the promise later;
// this also stops Node from reporting a rejection as unhandled until then.
function track<T>(run: () => Promise<T>): Tracked<T> {
  const tracked: Tracked<T> = { promise: run(), hasSettled: false };
  tracked.promise.then(
    () => (tracked.hasSettled = true),
    () => (tracked.hasSettled = true)
  );
  return tracked;
}

async function settlesWithin<T>(tracked: Tracked<T>, ms: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise((resolve) => (timer = setTimeout(resolve, ms)));
  await Promise.race([tracked.promise.catch(() => {}), timeout]);
  clearTimeout(timer);
  return tracked.hasSettled;
}

// Inserts a team for `repoFullName` in a transaction that takes no advisory
// lock and stays open while `run` runs, so a check in `run` can't see the
// row yet. Commits once `run` waits on that row or has finished, and returns
// what `run` returned.
export async function claimRepoPastTheLock<T>({
  repoFullName,
  run,
}: {
  repoFullName: string;
  run: () => Promise<T>;
}): Promise<T> {
  // Wrapped in an object so the transaction doesn't wait for `run` to finish:
  // it can't, while `run` waits on the uncommitted row.
  const { claim } = await db.$transaction(
    async (tx) => {
      await tx.team.create({
        data: { name: "Claimed past the lock", repoFullName },
      });
      const pid = await backendPid(tx);
      const claim = track(run);
      await waitUntil({
        condition: async () =>
          claim.hasSettled || (await countBackendsBlockedBy(pid)) > 0,
        message: "Expected the second claim to finish or to wait on the first.",
      });
      return { claim };
    },
    { timeout: WAIT_TIMEOUT_MS * 2 }
  );
  return claim.promise;
}

// Stalls an invite write for `teamId` right after it takes its advisory lock
// (a table lock holds up its writes to `invites`), then runs `run` and reports
// whether `run` finished while the invite write still held that lock. Lets
// both finish before returning.
export async function runWhileInviteWriteHoldsItsLock<T>({
  teamId,
  run,
}: {
  teamId: string;
  run: () => Promise<T>;
}): Promise<{ hasFinishedWhileHeld: boolean; result: T }> {
  const { invite, other, hasFinishedWhileHeld } = await db.$transaction(
    async (tx) => {
      await tx.$executeRaw`LOCK TABLE "invites" IN SHARE MODE`;
      const pid = await backendPid(tx);
      const invite = track(() =>
        createInvite({ teamId, role: "MEMBER", now: new Date() })
      );
      await waitUntil({
        condition: async () => (await countBackendsBlockedBy(pid)) > 0,
        message: "Expected the invite write to wait on the table lock.",
      });
      const other = track(run);
      return {
        invite,
        other,
        hasFinishedWhileHeld: await settlesWithin(other, HOLD_MS),
      };
    },
    { timeout: WAIT_TIMEOUT_MS * 2 }
  );
  await invite.promise;
  return { hasFinishedWhileHeld, result: await other.promise };
}
