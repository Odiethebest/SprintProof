import { describe, expect, it } from "vitest";
import { checkTeamAccess } from "@/lib/auth/team-access";

describe("checkTeamAccess", () => {
  it("returns 401 when the visitor is signed out", () => {
    // Act
    const access = checkTeamAccess({
      userId: null,
      membership: null,
      roles: ["LEAD", "MEMBER"],
    });

    // Assert
    expect(access).toEqual({
      isAllowed: false,
      status: 401,
      code: "UNAUTHENTICATED",
    });
  });

  it("returns 403 when the signed-in user is not on the team", () => {
    // Act
    const access = checkTeamAccess({
      userId: "user-1",
      membership: null,
      roles: ["LEAD", "MEMBER"],
    });

    // Assert
    expect(access).toEqual({
      isAllowed: false,
      status: 403,
      code: "FORBIDDEN",
    });
  });

  it("returns 403 when the member's role is not one of the allowed roles", () => {
    // Act
    const access = checkTeamAccess({
      userId: "user-1",
      membership: { role: "MEMBER" },
      roles: ["LEAD"],
    });

    // Assert
    expect(access).toEqual({
      isAllowed: false,
      status: 403,
      code: "FORBIDDEN",
    });
  });

  it("returns 403 for an instructor when only students are allowed", () => {
    // Act
    const access = checkTeamAccess({
      userId: "user-1",
      membership: { role: "INSTRUCTOR" },
      roles: ["LEAD", "MEMBER"],
    });

    // Assert
    expect(access).toEqual({
      isAllowed: false,
      status: 403,
      code: "FORBIDDEN",
    });
  });

  it("allows a member whose role is listed and returns the user id and role", () => {
    // Act
    const access = checkTeamAccess({
      userId: "user-1",
      membership: { role: "LEAD" },
      roles: ["LEAD"],
    });

    // Assert
    expect(access).toEqual({ isAllowed: true, userId: "user-1", role: "LEAD" });
  });
});
