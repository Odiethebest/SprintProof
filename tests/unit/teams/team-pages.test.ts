import { describe, expect, it } from "vitest";
import {
  REVIEW_ROLES,
  findTeamPage,
  getTeamNavPages,
  getTeamPagePath,
} from "@/lib/teams/team-pages";

const TEAM_ID = "team-1";

describe("getTeamPagePath", () => {
  it.each([
    ["dashboard", "/teams/team-1/dashboard"],
    ["standups", "/teams/team-1/standups"],
    ["settings", "/teams/team-1/settings"],
    ["review", "/review/team-1"],
  ] as const)("puts %s at its path", (page, path) => {
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

  it("finds the review page from its path outside the team's pages", () => {
    // Act
    const found = findTeamPage({ teamId: TEAM_ID, pathname: "/review/team-1" });

    // Assert
    expect(found).toBe("review");
  });

  it("finds no page for another team's review page", () => {
    // Act
    const found = findTeamPage({ teamId: TEAM_ID, pathname: "/review/team-2" });

    // Assert
    expect(found).toBeNull();
  });

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

describe("getTeamNavPages", () => {
  it.each(["LEAD", "INSTRUCTOR"] as const)(
    "lists Review for a %s, before Settings",
    (role) => {
      // Act
      const pages = getTeamNavPages({ role });

      // Assert
      expect(pages).toEqual(["dashboard", "standups", "review", "settings"]);
    }
  );

  it("leaves Review out for a member", () => {
    // Act
    const pages = getTeamNavPages({ role: "MEMBER" });

    // Assert
    expect(pages).toEqual(["dashboard", "standups", "settings"]);
  });
});

describe("REVIEW_ROLES", () => {
  it("lets leads and instructors open the review page", () => {
    // Assert
    expect([...REVIEW_ROLES].sort()).toEqual(["INSTRUCTOR", "LEAD"]);
  });
});
