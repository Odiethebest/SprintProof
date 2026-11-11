import { PrismaPg } from "@prisma/adapter-pg";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { checkHealth } from "@/server/health";

// Nothing listens on port 1, so every query fails to connect, as it does when
// Supabase has paused a project. The route passes the app's client; these
// tests pass this one instead, so no module is mocked.
const UNREACHABLE_PASSWORD = "health-test-password";
const unreachableDatabase = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: `postgresql://health:${UNREACHABLE_PASSWORD}@127.0.0.1:1/unreachable`,
  }),
});

const DEPLOYED_COMMIT = "97ead21f3c4b5a69788e0d1c2b3a4f5e6d7c8b9a";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

afterAll(async () => {
  await unreachableDatabase.$disconnect();
});

describe("GET /api/health", () => {
  it("returns ok and a null commit when the database answers outside Vercel", async () => {
    // Arrange
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", undefined);

    // Act
    const response = await checkHealth({ database: db });

    // Assert: these two fields only, so no team data
    expect(response.status).toBe(200);
    expect(await response.json()).toStrictEqual({ status: "ok", commit: null });
  });

  it("returns the Git commit Vercel deployed", async () => {
    // Arrange
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", DEPLOYED_COMMIT);

    // Act
    const response = await checkHealth({ database: db });

    // Assert
    expect(response.status).toBe(200);
    expect(await response.json()).toStrictEqual({
      status: "ok",
      commit: DEPLOYED_COMMIT,
    });
  });

  it("returns a null commit when VERCEL_GIT_COMMIT_SHA is empty", async () => {
    // Arrange
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "");

    // Act
    const response = await checkHealth({ database: db });

    // Assert
    expect(await response.json()).toStrictEqual({ status: "ok", commit: null });
  });

  it("returns 503 DATABASE_UNAVAILABLE when the database can't be reached", async () => {
    // Arrange
    vi.spyOn(console, "error").mockImplementation(() => {});

    // Act
    const response = await checkHealth({ database: unreachableDatabase });

    // Assert
    expect(response.status).toBe(503);
    expect(await response.json()).toStrictEqual({
      error: { code: "DATABASE_UNAVAILABLE", message: expect.any(String) },
    });
  });

  it("logs only the error code when the database can't be reached", async () => {
    // Arrange
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    // Act
    await checkHealth({ database: unreachableDatabase });

    // Assert: the error's message names the host, so it stays out of the log
    expect(log).toHaveBeenCalledTimes(1);
    const line = log.mock.calls[0].map(String).join(" ");
    expect(line).not.toContain("127.0.0.1");
    expect(line).not.toContain(UNREACHABLE_PASSWORD);
    // A Prisma code such as P2010, or an error name
    expect(log.mock.calls[0].at(-1)).toMatch(/^\w+$/);
  });

  it("tells caches not to store either answer", async () => {
    // Arrange
    vi.spyOn(console, "error").mockImplementation(() => {});

    // Act
    const healthy = await checkHealth({ database: db });
    const unavailable = await checkHealth({ database: unreachableDatabase });

    // Assert: a cached answer could show a commit production no longer serves
    expect(healthy.headers.get("cache-control")).toBe("no-store");
    expect(unavailable.headers.get("cache-control")).toBe("no-store");
  });
});
