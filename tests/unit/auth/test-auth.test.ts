import { describe, expect, it } from "vitest";
import { isTestAuthEnabled, toTestGithubUser } from "@/lib/auth/test-auth";

describe("isTestAuthEnabled", () => {
  it("is enabled when E2E_TEST_AUTH is exactly true outside Vercel", () => {
    expect(
      isTestAuthEnabled({ e2eTestAuth: "true", vercelEnv: undefined })
    ).toBe(true);
  });

  it("is disabled when E2E_TEST_AUTH is not set", () => {
    expect(
      isTestAuthEnabled({ e2eTestAuth: undefined, vercelEnv: undefined })
    ).toBe(false);
  });

  it.each(["", "false", "1", "TRUE", " true"])(
    "is disabled when E2E_TEST_AUTH is %j",
    (e2eTestAuth) => {
      expect(isTestAuthEnabled({ e2eTestAuth, vercelEnv: undefined })).toBe(
        false
      );
    }
  );

  it.each(["production", "preview", "development"])(
    "stays disabled on a Vercel %s deployment even when E2E_TEST_AUTH is true",
    (vercelEnv) => {
      expect(isTestAuthEnabled({ e2eTestAuth: "true", vercelEnv })).toBe(false);
    }
  );
});

describe("toTestGithubUser", () => {
  it("builds a test user with a synthetic GitHub id that can't match a real one", () => {
    // Act
    const user = toTestGithubUser({
      credentials: { login: "ziqi-e2e", name: "Ziqi (Odie) Yang" },
    });

    // Assert
    expect(user).toEqual({
      githubId: "e2e-ziqi-e2e",
      githubLogin: "ziqi-e2e",
      name: "Ziqi (Odie) Yang",
      avatarUrl: null,
    });
  });

  it.each([
    ["a login starting with a hyphen", { login: "-octo", name: "Octo" }],
    ["a login with a space", { login: "octo cat", name: "Octo" }],
    [
      "a login longer than 39 characters",
      { login: "a".repeat(40), name: "Octo" },
    ],
    ["a missing login", { name: "Octo" }],
    ["a missing name", { login: "octo" }],
    ["an empty name", { login: "octo", name: "" }],
  ])("rejects %s", (_label, credentials) => {
    expect(toTestGithubUser({ credentials })).toBeNull();
  });
});
