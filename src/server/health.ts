import type { PrismaClient } from "@/generated/prisma/client";
import { errorResponse } from "@/server/api-response";
import { describeDatabaseError } from "@/server/prisma-errors";

// Vercel sets this on every deployment built from Git; locally and in CI
// there's no deployed commit. An empty value counts as unset.
function readDeployedCommit(): string | null {
  return process.env.VERCEL_GIT_COMMIT_SHA || null;
}

// The Database workflow compares the commit with the one it just pushed, so no
// cache may answer for the deployment (.github/workflows/database.yml).
function withNoStore(response: Response): Response {
  response.headers.set("cache-control", "no-store");
  return response;
}

// GET /api/health: whether the database answers, and which commit this
// deployment runs. The client is a parameter so tests can pass one pointed at
// a database that isn't there.
export async function checkHealth({
  database,
}: {
  database: PrismaClient;
}): Promise<Response> {
  try {
    await database.$queryRaw`SELECT 1`;
  } catch (error) {
    // The code or name only: the error's message names the database host.
    console.error("Health check failed:", describeDatabaseError(error));
    return withNoStore(
      errorResponse({
        status: 503,
        code: "DATABASE_UNAVAILABLE",
        message: "Can't reach the database right now. Try again in a minute.",
      })
    );
  }
  return withNoStore(
    Response.json({ status: "ok", commit: readDeployedCommit() })
  );
}
