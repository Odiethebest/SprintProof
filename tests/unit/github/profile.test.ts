import { describe, expect, it } from "vitest";
import { toGithubUser } from "@/lib/github/profile";
import { createGithubProfile } from "../../factories";

describe("toGithubUser", () => {
  it("maps the GitHub id, login, name and avatar URL", () => {
    // Arrange
    const profile = createGithubProfile({
      id: 1001,
      login: "octo",
      name: "Octo Cat",
      avatar_url: "https://avatars.githubusercontent.com/u/1001?v=4",
    });

    // Act
    const user = toGithubUser({ profile });

    // Assert
    expect(user).toEqual({
      githubId: "1001",
      githubLogin: "octo",
      name: "Octo Cat",
      avatarUrl: "https://avatars.githubusercontent.com/u/1001?v=4",
    });
  });

  it("keeps the name empty when the GitHub profile has none", () => {
    // Arrange
    const profile = createGithubProfile({ name: null });

    // Act
    const user = toGithubUser({ profile });

    // Assert
    expect(user.name).toBeNull();
  });

  it("leaves out the email even when the public profile has one", () => {
    // Arrange: decision 001, SprintProof stores no email
    const profile = createGithubProfile({ email: "octo@example.com" });

    // Act
    const user = toGithubUser({ profile });

    // Assert
    expect(user).not.toHaveProperty("email");
    expect(Object.keys(user).sort()).toEqual([
      "avatarUrl",
      "githubId",
      "githubLogin",
      "name",
    ]);
  });

  it("rejects a profile without a numeric GitHub id", () => {
    // Arrange
    const profile = { ...createGithubProfile(), id: "1001" };

    // Act
    const act = () => toGithubUser({ profile });

    // Assert
    expect(act).toThrow();
  });

  it("rejects a profile without a login", () => {
    // Arrange
    const profile = { ...createGithubProfile(), login: "" };

    // Act
    const act = () => toGithubUser({ profile });

    // Assert
    expect(act).toThrow();
  });
});
