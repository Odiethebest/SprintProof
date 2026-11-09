import crypto from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import { getSessionUserId } from "@/server/auth-session";
import { POST } from "@/app/api/v1/tokens/route";
import { DELETE } from "@/app/api/v1/tokens/[tokenId]/route";
import { insertApiToken, insertUser } from "../../factories/db";
import { apiRequest, routeContext } from "../helpers/requests";
import { clearDatabase } from "../setup/test-setup";

vi.mock("@/server/auth-session", () => ({ getSessionUserId: vi.fn() }));

const TOKEN_PATTERN = /^spk_live_[A-Za-z0-9_-]{43}$/;

async function signIn() {
  const user = await insertUser();
  vi.mocked(getSessionUserId).mockResolvedValue(user.id);
  return user;
}

function signOut() {
  vi.mocked(getSessionUserId).mockResolvedValue(null);
}

function createToken(body: unknown) {
  return POST(apiRequest("POST", "/tokens", body));
}

function revokeToken(tokenId: string) {
  return DELETE(
    apiRequest("DELETE", `/tokens/${tokenId}`),
    routeContext({ tokenId })
  );
}

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

describe("POST /api/v1/tokens", () => {
  beforeEach(async () => {
    await clearDatabase();
    vi.mocked(getSessionUserId).mockReset();
  });

  it("creates a token for the signed-in user and returns it once", async () => {
    // Arrange
    const user = await signIn();

    // Act
    const res = await createToken({ name: "Grading script" });

    // Assert
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toEqual({
      id: expect.any(String),
      name: "Grading script",
      token: expect.stringMatching(TOKEN_PATTERN),
      last4: body.token.slice(-4),
      createdAt: expect.any(String),
      lastUsedAt: null,
    });
    const rows = await db.apiToken.findMany({ where: { userId: user.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(body.id);
  });

  it("stores only the SHA-256 hash and the last 4 characters", async () => {
    // Arrange
    await signIn();

    // Act
    const res = await createToken({ name: "Grading script" });

    // Assert
    const { id, token } = await res.json();
    const row = await db.apiToken.findUniqueOrThrow({ where: { id } });
    expect(row.tokenHash).toBe(sha256(token));
    expect(row.last4).toBe(token.slice(-4));
    expect(JSON.stringify(row)).not.toContain(token);
  });

  it("gives every token a different value", async () => {
    // Arrange
    await signIn();

    // Act
    const first = await (await createToken({ name: "First" })).json();
    const second = await (await createToken({ name: "Second" })).json();

    // Assert
    expect(first.token).not.toBe(second.token);
  });

  it("trims the spaces around the name", async () => {
    // Arrange
    await signIn();

    // Act
    const res = await createToken({ name: "  Local scripts  " });

    // Assert
    expect(res.status).toBe(201);
    expect((await res.json()).name).toBe("Local scripts");
  });

  it.each([
    ["an empty name", { name: "" }, "Name the token."],
    ["a missing name", {}, "Name the token."],
    [
      "a name over 50 characters",
      { name: "a".repeat(51) },
      "Keep the name to 50 characters or fewer.",
    ],
  ])("returns 400 for %s and stores nothing", async (_, body, message) => {
    // Arrange
    await signIn();

    // Act
    const res = await createToken(body);

    // Assert
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: { code: "VALIDATION_ERROR", message },
    });
    expect(await db.apiToken.count()).toBe(0);
  });

  it("returns 400 when the body isn't JSON", async () => {
    // Arrange
    await signIn();
    const request = new Request("http://localhost:3000/api/v1/tokens", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not json",
    });

    // Act
    const res = await POST(request);

    // Assert
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 401 when no one is signed in", async () => {
    // Arrange
    signOut();

    // Act
    const res = await createToken({ name: "Grading script" });

    // Assert
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("UNAUTHENTICATED");
    expect(await db.apiToken.count()).toBe(0);
  });
});

describe("DELETE /api/v1/tokens/{tokenId}", () => {
  beforeEach(async () => {
    await clearDatabase();
    vi.mocked(getSessionUserId).mockReset();
  });

  it("revokes the signed-in user's token", async () => {
    // Arrange
    const user = await signIn();
    const { record } = await insertApiToken({ userId: user.id });

    // Act
    const res = await revokeToken(record.id);

    // Assert
    expect(res.status).toBe(204);
    expect(await db.apiToken.count()).toBe(0);
  });

  it("returns 404 for another user's token and leaves it alone", async () => {
    // Arrange
    const owner = await insertUser();
    const { record } = await insertApiToken({ userId: owner.id });
    await signIn();

    // Act
    const res = await revokeToken(record.id);

    // Assert
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      error: {
        code: "TOKEN_NOT_FOUND",
        message: "You have no API token with that id.",
      },
    });
    expect(await db.apiToken.count()).toBe(1);
  });

  it("returns 404 for a token that was already revoked", async () => {
    // Arrange
    const user = await signIn();
    const { record } = await insertApiToken({ userId: user.id });
    await revokeToken(record.id);

    // Act
    const res = await revokeToken(record.id);

    // Assert
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("TOKEN_NOT_FOUND");
  });

  it("returns 401 when no one is signed in", async () => {
    // Arrange
    const owner = await insertUser();
    const { record } = await insertApiToken({ userId: owner.id });
    signOut();

    // Act
    const res = await revokeToken(record.id);

    // Assert
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("UNAUTHENTICATED");
    expect(await db.apiToken.count()).toBe(1);
  });
});
