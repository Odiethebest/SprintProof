import { describe, expect, it } from "vitest";
import {
  LIVE_PAGES,
  REVIEW_ROLES,
  SPRINT_PAGES,
  findRetroSprintId,
  findTeamPage,
  getSprintPagePath,
  getTeamNavPages,
  getTeamPagePath,
} from "@/lib/teams/team-pages";

const TEAM_ID = "team-1";

describe("getTeamPagePath", () => {
  it.each([
    ["dashboard", "/teams/team-1/dashboard"],
    ["standups", "/teams/team-1/standups"],
    ["retro", "/teams/team-1/retro"],
    ["settings", "/teams/team-1/settings"],
    ["review", "/review/team-1"],
  ] as const)("puts %s at its path", (page, path) => {
    // Act
    const pagePath = getTeamPagePath({ teamId: TEAM_ID, page });

    // Assert
    expect(pagePath).toBe(path);
  });
});

describe("getSprintPagePath", () => {
  it.each([
    ["dashboard", "/teams/team-1/dashboard?sprint=sprint-0"],
    ["standups", "/teams/team-1/standups?sprint=sprint-0"],
    ["review", "/review/team-1?sprint=sprint-0"],
    ["retro", "/teams/team-1/sprints/sprint-0/retro"],
  ] as const)("shows the sprint on %s at %s", (page, path) => {
    // Act
    const pagePath = getSprintPagePath({
      teamId: TEAM_ID,
      page,
      sprintId: "sprint-0",
    });

    // Assert
    expect(pagePath).toBe(path);
  });

  it("encodes a sprint id that isn't URL-safe", () => {
    // Act
    const pagePath = getSprintPagePath({
      teamId: TEAM_ID,
      page: "retro",
      sprintId: "a/b",
    });

    // Assert
    expect(pagePath).toBe("/teams/team-1/sprints/a%2Fb/retro");
  });
});

describe("findTeamPage", () => {
  it.each(["dashboard", "standups", "retro", "settings"] as const)(
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

  it("finds the retro page from a sprint's retro path (#13)", () => {
    // Act
    const found = findTeamPage({
      teamId: TEAM_ID,
      pathname: "/teams/team-1/sprints/sprint-1/retro",
    });

    // Assert
    expect(found).toBe("retro");
  });

  it("finds no page for another team's sprint retro", () => {
    // Act
    const found = findTeamPage({
      teamId: TEAM_ID,
      pathname: "/teams/team-2/sprints/sprint-1/retro",
    });

    // Assert
    expect(found).toBeNull();
  });

  it("finds no page for a path below a sprint's retro", () => {
    // Act
    const found = findTeamPage({
      teamId: TEAM_ID,
      pathname: "/teams/team-1/sprints/sprint-1/retro/items",
    });

    // Assert
    expect(found).toBeNull();
  });

  it("finds no page for a team path the navigation doesn't list", () => {
    // Act
    const found = findTeamPage({
      teamId: TEAM_ID,
      pathname: "/teams/team-1/sprints/sprint-1/planning",
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
      expect(pages).toEqual([
        "dashboard",
        "standups",
        "retro",
        "review",
        "settings",
      ]);
    }
  );

  it("leaves Review out for a member", () => {
    // Act
    const pages = getTeamNavPages({ role: "MEMBER" });

    // Assert
    expect(pages).toEqual(["dashboard", "standups", "retro", "settings"]);
  });
});

describe("REVIEW_ROLES", () => {
  it("lets leads and instructors open the review page", () => {
    // Assert
    expect([...REVIEW_ROLES].sort()).toEqual(["INSTRUCTOR", "LEAD"]);
  });
});

describe("findRetroSprintId", () => {
  it("reads the sprint from a sprint's retro path", () => {
    // Act
    const sprintId = findRetroSprintId({
      teamId: TEAM_ID,
      pathname: "/teams/team-1/sprints/sprint-1/retro",
    });

    // Assert
    expect(sprintId).toBe("sprint-1");
  });

  it.each([
    "/teams/team-1/retro",
    "/teams/team-1/dashboard",
    "/teams/team-2/sprints/sprint-1/retro",
    "/teams/team-1/sprints/sprint-1/retro/items",
    "/teams/team-1/sprints//retro",
  ])("reads no sprint from %s", (pathname) => {
    // Act
    const sprintId = findRetroSprintId({ teamId: TEAM_ID, pathname });

    // Assert
    expect(sprintId).toBeNull();
  });
});

describe("SPRINT_PAGES", () => {
  it("keeps the selected sprint on the retro page too", () => {
    // Assert
    expect(SPRINT_PAGES).toEqual(["dashboard", "standups", "retro", "review"]);
  });
});

describe("LIVE_PAGES", () => {
  it("updates the retro live, as the dashboard and standups do", () => {
    // Assert
    expect(LIVE_PAGES).toEqual(["dashboard", "standups", "retro"]);
  });
});
