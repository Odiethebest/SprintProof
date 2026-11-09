import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import {
  createApiToken,
  deleteApiToken,
  listApiTokens,
} from "@/server/repositories/api-tokens";
import { insertApiToken, insertUser } from "../../factories/db";
import { clearDatabase } from "../setup/test-setup";

const HASH = "a".repeat(64);

describe("createApiToken", () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  it("stores the hash and returns the token without it", async () => {
    // Arrange
    const user = await insertUser();

    // Act
    const created = await createApiToken({
      userId: user.id,
      name: "Grading script",
      tokenHash: HASH,
      last4: "3f9a",
    });

    // Assert
    expect(created).toEqual({
      id: expect.any(String),
      name: "Grading script",
      last4: "3f9a",
      createdAt: expect.any(Date),
      lastUsedAt: null,
    });
    const row = await db.apiToken.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(row.tokenHash).toBe(HASH);
    expect(row.userId).toBe(user.id);
  });
});

describe("listApiTokens", () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  it("lists only the user's own tokens, newest first", async () => {
    // Arrange
    const user = await insertUser();
    const other = await insertUser();
    await insertApiToken({
      userId: user.id,
      name: "Older",
      createdAt: new Date("2026-11-01T10:00:00.000Z"),
    });
    await insertApiToken({
      userId: user.id,
      name: "Newer",
      createdAt: new Date("2026-11-07T10:00:00.000Z"),
      lastUsedAt: new Date("2026-11-08T09:00:00.000Z"),
    });
    await insertApiToken({ userId: other.id, name: "Someone else's" });

    // Act
    const tokens = await listApiTokens({ userId: user.id });

    // Assert
    expect(tokens.map((token) => token.name)).toEqual(["Newer", "Older"]);
    expect(tokens[0]).toEqual({
      id: expect.any(String),
      name: "Newer",
      last4: expect.stringMatching(/^.{4}$/),
      createdAt: new Date("2026-11-07T10:00:00.000Z"),
      lastUsedAt: new Date("2026-11-08T09:00:00.000Z"),
    });
  });

  it("returns an empty list for a user with no tokens", async () => {
    // Arrange
    const user = await insertUser();

    // Act
    const tokens = await listApiTokens({ userId: user.id });

    // Assert
    expect(tokens).toEqual([]);
  });
});

describe("deleteApiToken", () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  it("deletes the user's token and says it found one", async () => {
    // Arrange
    const user = await insertUser();
    const { record } = await insertApiToken({ userId: user.id });

    // Act
    const isDeleted = await deleteApiToken({
      userId: user.id,
      tokenId: record.id,
    });

    // Assert
    expect(isDeleted).toBe(true);
    expect(await db.apiToken.count()).toBe(0);
  });

  it("doesn't delete another user's token", async () => {
    // Arrange
    const owner = await insertUser();
    const other = await insertUser();
    const { record } = await insertApiToken({ userId: owner.id });

    // Act
    const isDeleted = await deleteApiToken({
      userId: other.id,
      tokenId: record.id,
    });

    // Assert
    expect(isDeleted).toBe(false);
    expect(await db.apiToken.count()).toBe(1);
  });
});
