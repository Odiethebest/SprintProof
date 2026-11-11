import { describe, expect, it } from "vitest";
import { findTeamPage, getTeamPagePath } from "@/lib/teams/team-pages";

const TEAM_ID = "team-1";

describe("getTeamPagePath", () => {
  it.each([
    ["dashboard", "/teams/team-1/dashboard"],
    ["standups", "/teams/team-1/standups"],
    ["settings", "/teams/team-1/settings"],
  ] as const)("puts %s under the team's path", (page, path) => {
    // Act
    const pagePath = getTeamPagePath({ teamId: TEAM_ID, page });

    // Assert
    expect(pagePath).toBe(path);
  });
});

describe("findTeamPage", () => {
  it.each(["dashboard", "standups", "settings"] as const)(
    "finds %s from its path",
    (page) => {
      // Act
      const found = findTeamPage({
        teamId: TEAM_ID,
        pathname: `/teams/team-1/${page}`,
      });

      // Assert
      expect(found).toBe(page);
    }
  );

  it("finds no page for a team path the navigation doesn't list", () => {
    // Act
    const found = findTeamPage({
      teamId: TEAM_ID,
      pathname: "/teams/team-1/sprints/sprint-1/retro",
    });

    // Assert
    expect(found).toBeNull();
  });

  it("finds no page for a path below a listed page", () => {
    // Act
    const found = findTeamPage({
      teamId: TEAM_ID,
      pathname: "/teams/team-1/settings/tokens",
    });

    // Assert
    expect(found).toBeNull();
  });

  it("finds no page for the same page of another team", () => {
    // Act
    const found = findTeamPage({
      teamId: TEAM_ID,
      pathname: "/teams/team-2/dashboard",
    });

    // Assert
    expect(found).toBeNull();
  });
});
