// Control over inserts into the `activities` table, for tests that need a real
// database failure or a real race. Integration tests mock only the external
// service wrappers (AGENTS.md §1 Testing), so these change the test database
// itself and undo it afterwards.
import { db } from "@/server/db";

const QUEUE_TIMEOUT_MS = 5000;
const POLL_INTERVAL_MS = 10;

// Every insert into `activities` fails while `run` runs: a CHECK constraint no
// row passes. PostgreSQL puts the failing row's values in the error's detail,
// so a test can also check that those values never reach a log.
export async function withFailingActivityInserts<T>(
  run: () => Promise<T>
): Promise<T> {
  await db.$executeRaw`ALTER TABLE "activities" ADD CONSTRAINT "activities_fail_in_test" CHECK (false) NOT VALID`;
  try {
    return await run();
  } finally {
    await db.$executeRaw`ALTER TABLE "activities" DROP CONSTRAINT "activities_fail_in_test"`;
  }
}

async function countQueuedActivityInserts(): Promise<number> {
  // pg_locks covers every database on the server, and other test runs may
  // share it, so count only this database's waiters.
  const [row] = await db.$queryRaw<{ queued: number }[]>`
    SELECT count(*)::int AS queued
    FROM pg_locks
    WHERE locktype = 'relation'
      AND database = (SELECT oid FROM pg_database WHERE datname = current_database())
      AND relation = '"activities"'::regclass
      AND NOT granted`;
  return row.queued;
}

async function waitForQueuedActivityInserts(count: number): Promise<void> {
  const deadline = Date.now() + QUEUE_TIMEOUT_MS;
  while ((await countQueuedActivityInserts()) < count) {
    if (Date.now() > deadline) {
      throw new Error(
        `Expected ${count} inserts into activities to wait for the lock.`
      );
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

// Holds inserts into `activities` behind a table lock until `count` of them are
// waiting, then releases them at once, so their writes overlap in the database.
// Without it, one request's insert can finish before the other's starts.
export async function releaseActivityInsertsTogether<T>({
  count,
  run,
}: {
  count: number;
  run: () => Promise<T>;
}): Promise<T> {
  // Wrapped in an object so the transaction doesn't wait for `run` to finish:
  // it can't, while it still holds the lock.
  const { pending } = await db.$transaction(
    async (tx) => {
      await tx.$executeRaw`LOCK TABLE "activities" IN SHARE MODE`;
      const started = run();
      // Awaited by the caller once the lock is released; this only stops Node
      // from reporting a rejection as unhandled in the meantime.
      started.catch(() => {});
      await waitForQueuedActivityInserts(count);
      return { pending: started };
    },
    { timeout: QUEUE_TIMEOUT_MS * 2 }
  );
  return pending;
}
