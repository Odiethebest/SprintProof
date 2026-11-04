import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { db } from "@/server/db";
import { GET, POST } from "@/app/api/auth/[...nextauth]/route";
import { clearDatabase } from "../setup/test-setup";

const AUTH_BASE = "http://localhost:3000/api/auth";

function cookieHeader(res: Response): string {
  return res.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
}

function hasSessionCookie(res: Response): boolean {
  return res.headers
    .getSetCookie()
    .some((cookie) => cookie.startsWith("authjs.session-token="));
}

async function getCsrf(): Promise<{ csrfToken: string; cookie: string }> {
  const res = await GET(new NextRequest(`${AUTH_BASE}/csrf`));
  const { csrfToken } = (await res.json()) as { csrfToken: string };
  return { csrfToken, cookie: cookieHeader(res) };
}

async function postForm(
  path: string,
  fields: Record<string, string>
): Promise<Response> {
  const { csrfToken, cookie } = await getCsrf();
  return POST(
    new NextRequest(`${AUTH_BASE}${path}`, {
      method: "POST",
      headers: { cookie, "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ csrfToken, callbackUrl: "/", ...fields }),
    })
  );
}

async function getProviderIds(): Promise<string[]> {
  const res = await GET(new NextRequest(`${AUTH_BASE}/providers`));
  return Object.keys((await res.json()) as Record<string, unknown>);
}

describe("/api/auth", () => {
  beforeEach(async () => {
    await clearDatabase();
    vi.stubEnv("AUTH_SECRET", "integration-test-secret-at-least-32-chars");
    vi.stubEnv("AUTH_GITHUB_ID", "test-client-id");
    vi.stubEnv("AUTH_GITHUB_SECRET", "test-client-secret");
    vi.stubEnv("VERCEL_ENV", undefined);
    vi.stubEnv("E2E_TEST_AUTH", undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("providers", () => {
    it("offers only GitHub when E2E_TEST_AUTH is not set", async () => {
      expect(await getProviderIds()).toEqual(["github"]);
    });

    it("adds the test credentials provider when E2E_TEST_AUTH is true", async () => {
      // Arrange
      vi.stubEnv("E2E_TEST_AUTH", "true");

      // Act
      const ids = await getProviderIds();

      // Assert
      expect(ids).toEqual(["github", "e2e-credentials"]);
    });
  });

  describe("GitHub sign-in", () => {
    it("redirects to GitHub and requests no OAuth scopes", async () => {
      // Act: decision 001
      const res = await postForm("/signin/github", {});

      // Assert
      const location = new URL(res.headers.get("location")!);
      expect(`${location.origin}${location.pathname}`).toBe(
        "https://github.com/login/oauth/authorize"
      );
      expect(location.searchParams.has("scope")).toBe(true);
      expect(location.searchParams.get("scope")).toBe("");
    });
  });

  describe("test credentials sign-in", () => {
    it("creates the test user and starts a session when E2E_TEST_AUTH is true", async () => {
      // Arrange
      vi.stubEnv("E2E_TEST_AUTH", "true");

      // Act
      const res = await postForm("/callback/e2e-credentials", {
        login: "ziqi-e2e",
        name: "Ziqi (Odie) Yang",
      });

      // Assert
      const user = await db.user.findUniqueOrThrow({
        where: { githubId: "e2e-ziqi-e2e" },
      });
      const sessionRes = await GET(
        new NextRequest(`${AUTH_BASE}/session`, {
          headers: { cookie: cookieHeader(res) },
        })
      );
      const session = (await sessionRes.json()) as {
        user: Record<string, unknown>;
      };
      expect(session.user).toMatchObject({
        id: user.id,
        githubLogin: "ziqi-e2e",
        name: "Ziqi (Odie) Yang",
      });
    });

    it("doesn't sign anyone in when E2E_TEST_AUTH is not set", async () => {
      // Act
      const res = await postForm("/callback/e2e-credentials", {
        login: "ziqi-e2e",
        name: "Ziqi (Odie) Yang",
      });

      // Assert
      expect(hasSessionCookie(res)).toBe(false);
      expect(await db.user.count()).toBe(0);
    });

    it("rejects a login that isn't a valid GitHub login", async () => {
      // Arrange
      vi.stubEnv("E2E_TEST_AUTH", "true");

      // Act
      const res = await postForm("/callback/e2e-credentials", {
        login: "-not valid",
        name: "Nobody",
      });

      // Assert
      expect(hasSessionCookie(res)).toBe(false);
      expect(await db.user.count()).toBe(0);
    });
  });
});
