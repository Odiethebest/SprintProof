import { beforeEach, describe, expect, it } from "vitest";
import type { NextAuthConfig } from "next-auth";
import { db } from "@/server/db";
import { createAuthConfig } from "@/server/auth-config";
import { createGithubProfile } from "../../factories";
import { clearDatabase } from "../setup/test-setup";

type Callbacks = NonNullable<NextAuthConfig["callbacks"]>;
type JwtParams = Parameters<NonNullable<Callbacks["jwt"]>>[0];
type SessionParams = Parameters<NonNullable<Callbacks["session"]>>[0];

const AVATAR_URL = "https://avatars.githubusercontent.com/u/1001?v=4";

function callbacks(): Callbacks {
  return createAuthConfig({ isTestAuthEnabled: false }).callbacks!;
}

function githubSignIn(
  profile: ReturnType<typeof createGithubProfile>
): JwtParams {
  // What Auth.js passes to the jwt callback right after GitHub redirects back
  return {
    token: {
      name: profile.name,
      email: profile.email,
      picture: profile.avatar_url,
      sub: "1001",
    },
    user: {
      id: "1001",
      name: profile.name,
      email: profile.email,
      image: profile.avatar_url,
    },
    account: {
      provider: "github",
      type: "oauth",
      providerAccountId: String(profile.id),
      access_token: "gho_test_access_token",
      token_type: "bearer",
      scope: "",
    },
    profile,
    trigger: "signIn",
  };
}

describe("createAuthConfig", () => {
  it("uses JWT sessions", () => {
    expect(
      createAuthConfig({ isTestAuthEnabled: false }).session?.strategy
    ).toBe("jwt");
  });
});

describe("jwt callback", () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  it("creates the user on first GitHub sign-in", async () => {
    // Arrange
    const profile = createGithubProfile();

    // Act
    await callbacks().jwt!(githubSignIn(profile));

    // Assert
    const user = await db.user.findUniqueOrThrow({
      where: { githubId: "1001" },
    });
    expect(user).toMatchObject({
      githubLogin: "octo",
      name: "Octo Cat",
      avatarUrl: AVATAR_URL,
    });
  });

  it("keeps only the user id and public profile in the token, never the access token or email", async () => {
    // Arrange: decision 001
    const profile = createGithubProfile({ email: "octo@example.com" });

    // Act
    const token = await callbacks().jwt!(githubSignIn(profile));

    // Assert
    const user = await db.user.findUniqueOrThrow({
      where: { githubId: "1001" },
    });
    expect(token).toEqual({
      sub: user.id,
      githubLogin: "octo",
      name: "Octo Cat",
      picture: AVATAR_URL,
    });
    expect(JSON.stringify(token)).not.toContain("gho_test_access_token");
  });

  it("refuses a GitHub sign-in whose profile has no GitHub id", async () => {
    // Arrange
    const profile = {
      ...createGithubProfile(),
      id: undefined,
    } as unknown as ReturnType<typeof createGithubProfile>;

    // Act
    const signIn = callbacks().jwt!(githubSignIn(profile));

    // Assert
    await expect(signIn).rejects.toThrow();
    expect(await db.user.count()).toBe(0);
  });

  it("returns the token unchanged on requests after sign-in", async () => {
    // Arrange
    const existing = {
      sub: "user-1",
      githubLogin: "octo",
      name: "Octo Cat",
      picture: AVATAR_URL,
    };

    // Act
    const token = await callbacks().jwt!({
      token: existing,
      account: null,
    } as JwtParams);

    // Assert
    expect(token).toEqual(existing);
    expect(await db.user.count()).toBe(0);
  });
});

describe("session callback", () => {
  it("exposes the user id, GitHub login, name and avatar, and no email", async () => {
    // Arrange
    const params = {
      session: {
        user: {
          name: "Octo Cat",
          email: "octo@example.com",
          image: AVATAR_URL,
        },
        expires: "2026-12-04T00:00:00.000Z",
      },
      token: {
        sub: "user-1",
        githubLogin: "octo",
        name: "Octo Cat",
        picture: AVATAR_URL,
      },
    } as SessionParams;

    // Act
    const session = await callbacks().session!(params);

    // Assert
    expect(session).toEqual({
      user: {
        id: "user-1",
        githubLogin: "octo",
        name: "Octo Cat",
        image: AVATAR_URL,
      },
      expires: "2026-12-04T00:00:00.000Z",
    });
  });
});
