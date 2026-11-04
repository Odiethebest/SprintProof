import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSessionUserId } from "@/server/auth-session";
import { requireTeamRole } from "@/server/auth";
import { insertMembership, insertTeam, insertUser } from "../../factories/db";
import { clearDatabase } from "../setup/test-setup";

// Auth.js reads the session from the request cookies, which only exist inside
// a Next.js request. Mock the session wrapper; everything else hits the database.
vi.mock("@/server/auth-session", () => ({ getSessionUserId: vi.fn() }));

describe("requireTeamRole", () => {
  beforeEach(async () => {
    await clearDatabase();
    vi.mocked(getSessionUserId).mockReset();
  });

  it("returns 401 when the visitor is signed out", async () => {
    // Arrange
    const team = await insertTeam();
    vi.mocked(getSessionUserId).mockResolvedValue(null);

    // Act
    const access = await requireTeamRole(team.id, ["LEAD", "MEMBER"]);

    // Assert
    expect(access).toEqual({
      isAllowed: false,
      status: 401,
      code: "UNAUTHENTICATED",
    });
  });

  it("returns 403 when the signed-in user is not on the team", async () => {
    // Arrange
    const team = await insertTeam();
    const user = await insertUser();
    vi.mocked(getSessionUserId).mockResolvedValue(user.id);

    // Act
    const access = await requireTeamRole(team.id, ["LEAD", "MEMBER"]);

    // Assert
    expect(access).toEqual({
      isAllowed: false,
      status: 403,
      code: "FORBIDDEN",
    });
  });

  it("returns 403 when the user leads a different team", async () => {
    // Arrange
    const team = await insertTeam();
    const otherTeam = await insertTeam();
    const user = await insertUser();
    await insertMembership({
      userId: user.id,
      teamId: otherTeam.id,
      role: "LEAD",
    });
    vi.mocked(getSessionUserId).mockResolvedValue(user.id);

    // Act
    const access = await requireTeamRole(team.id, ["LEAD"]);

    // Assert
    expect(access).toEqual({
      isAllowed: false,
      status: 403,
      code: "FORBIDDEN",
    });
  });

  it("returns 403 when the member's role is not allowed", async () => {
    // Arrange
    const team = await insertTeam();
    const user = await insertUser();
    await insertMembership({
      userId: user.id,
      teamId: team.id,
      role: "MEMBER",
    });
    vi.mocked(getSessionUserId).mockResolvedValue(user.id);

    // Act
    const access = await requireTeamRole(team.id, ["LEAD"]);

    // Assert
    expect(access).toEqual({
      isAllowed: false,
      status: 403,
      code: "FORBIDDEN",
    });
  });

  it("allows a member with an allowed role and returns their user id and role", async () => {
    // Arrange
    const team = await insertTeam();
    const user = await insertUser();
    await insertMembership({ userId: user.id, teamId: team.id, role: "LEAD" });
    vi.mocked(getSessionUserId).mockResolvedValue(user.id);

    // Act
    const access = await requireTeamRole(team.id, ["LEAD"]);

    // Assert
    expect(access).toEqual({ isAllowed: true, userId: user.id, role: "LEAD" });
  });
});
