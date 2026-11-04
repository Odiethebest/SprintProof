import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { upsertGithubUser } from "@/server/repositories/users";
import { createGithubUser } from "../../factories";
import { insertUser } from "../../factories/db";
import { clearDatabase } from "../setup/test-setup";

describe("upsertGithubUser", () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  it("creates a user with GitHub id, login, name and avatar URL on first sign-in", async () => {
    // Arrange
    const githubUser = createGithubUser();

    // Act
    const user = await upsertGithubUser(githubUser);

    // Assert
    expect(user).toMatchObject({
      githubId: "1001",
      githubLogin: "octo",
      name: "Octo Cat",
      avatarUrl: "https://avatars.githubusercontent.com/u/1001?v=4",
    });
    expect(await db.user.count()).toBe(1);
  });

  it("updates login, name and avatar URL on a later sign-in with the same GitHub id", async () => {
    // Arrange
    const first = await upsertGithubUser(createGithubUser());

    // Act
    const second = await upsertGithubUser(
      createGithubUser({
        githubLogin: "octo-renamed",
        name: "Octo",
        avatarUrl: "https://avatars.githubusercontent.com/u/1001?v=5",
      })
    );

    // Assert
    expect(second.id).toBe(first.id);
    expect(second).toMatchObject({
      githubLogin: "octo-renamed",
      name: "Octo",
      avatarUrl: "https://avatars.githubusercontent.com/u/1001?v=5",
    });
    expect(await db.user.count()).toBe(1);
  });

  it("frees a login that another GitHub account held before renaming", async () => {
    // Arrange: account 2002 was "octo", renamed on GitHub, and hasn't signed in since
    const previousHolder = await insertUser({
      githubId: "2002",
      githubLogin: "octo",
    });

    // Act: account 1001 now owns "octo" and signs in
    const user = await upsertGithubUser(
      createGithubUser({ githubId: "1001", githubLogin: "octo" })
    );

    // Assert
    expect(user.githubLogin).toBe("octo");
    const refreshed = await db.user.findUniqueOrThrow({
      where: { id: previousHolder.id },
    });
    expect(refreshed.githubLogin).toBeNull();
  });

  it("stores no email address", async () => {
    // Act: decision 001
    const user = await upsertGithubUser(createGithubUser());

    // Assert
    expect(user).not.toHaveProperty("email");
  });
});

describe("users table", () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  it("requires a GitHub id", async () => {
    // Act
    const insert = db.$executeRaw`
      INSERT INTO users (id, github_login, updated_at) VALUES ('user-without-github-id', 'nobody', now())
    `;

    // Assert
    await expect(insert).rejects.toThrow();
  });
});
