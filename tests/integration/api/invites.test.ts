import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import { getSessionUserId } from "@/server/auth-session";
import type { TeamRole } from "@/lib/auth/team-access";
import { POST } from "@/app/api/v1/teams/[teamId]/invites/route";
import { DELETE } from "@/app/api/v1/teams/[teamId]/invites/[inviteId]/route";
import {
  insertInvite,
  insertMembership,
  insertTeam,
  insertUser,
} from "../../factories/db";
import { apiRequest, routeContext } from "../helpers/requests";
import { clearDatabase } from "../setup/test-setup";

vi.mock("@/server/auth-session", () => ({ getSessionUserId: vi.fn() }));

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

async function signInAs(teamId: string, role: TeamRole) {
  const user = await insertUser();
  await insertMembership({ userId: user.id, teamId, role });
  vi.mocked(getSessionUserId).mockResolvedValue(user.id);
  return user;
}

function createInvite(teamId: string, body: unknown) {
  return POST(
    apiRequest("POST", `/teams/${teamId}/invites`, body),
    routeContext({ teamId })
  );
}

function revokeInvite(teamId: string, inviteId: string) {
  return DELETE(
    apiRequest("DELETE", `/teams/${teamId}/invites/${inviteId}`),
    routeContext({ teamId, inviteId })
  );
}

describe("POST /api/v1/teams/{teamId}/invites", () => {
  beforeEach(async () => {
    await clearDatabase();
    vi.mocked(getSessionUserId).mockReset();
  });

  it.each(["MEMBER", "INSTRUCTOR"] as const)(
    "lets the lead create a %s invite link that expires in 7 days",
    async (role) => {
      // Arrange
      const team = await insertTeam();
      await signInAs(team.id, "LEAD");
      const before = Date.now();

      // Act
      const res = await createInvite(team.id, { role });

      // Assert
      const after = Date.now();
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body).toEqual({
        id: expect.any(String),
        role,
        token: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
        expiresAt: expect.any(String),
      });
      const expiresAt = Date.parse(body.expiresAt);
      expect(expiresAt).toBeGreaterThanOrEqual(before + SEVEN_DAYS_MS);
      expect(expiresAt).toBeLessThanOrEqual(after + SEVEN_DAYS_MS);
      const stored = await db.invite.findUniqueOrThrow({
        where: { id: body.id },
      });
      expect(stored).toMatchObject({
        teamId: team.id,
        role,
        token: body.token,
        revokedAt: null,
      });
    }
  );

  it("gives every link a different token", async () => {
    // Arrange
    const team = await insertTeam();
    await signInAs(team.id, "LEAD");

    // Act
    const member = await (
      await createInvite(team.id, { role: "MEMBER" })
    ).json();
    const instructor = await (
      await createInvite(team.id, { role: "INSTRUCTOR" })
    ).json();

    // Assert
    expect(member.token).not.toBe(instructor.token);
  });

  it("revokes the team's previous link for the same role and keeps the other role's link", async () => {
    // Arrange
    const team = await insertTeam();
    await signInAs(team.id, "LEAD");
    const oldMember = await insertInvite({ teamId: team.id, role: "MEMBER" });
    const instructor = await insertInvite({
      teamId: team.id,
      role: "INSTRUCTOR",
    });

    // Act
    const res = await createInvite(team.id, { role: "MEMBER" });

    // Assert
    expect(res.status).toBe(201);
    const newMember = await res.json();
    const invites = await db.invite.findMany({ where: { teamId: team.id } });
    const byId = new Map(invites.map((invite) => [invite.id, invite]));
    expect(byId.get(oldMember.id)?.revokedAt).toBeInstanceOf(Date);
    expect(byId.get(newMember.id)?.revokedAt).toBeNull();
    expect(byId.get(instructor.id)?.revokedAt).toBeNull();
  });

  it("leaves other teams' links alone", async () => {
    // Arrange
    const team = await insertTeam();
    const otherTeam = await insertTeam();
    await signInAs(team.id, "LEAD");
    const otherInvite = await insertInvite({
      teamId: otherTeam.id,
      role: "MEMBER",
    });

    // Act
    await createInvite(team.id, { role: "MEMBER" });

    // Assert
    const stored = await db.invite.findUniqueOrThrow({
      where: { id: otherInvite.id },
    });
    expect(stored.revokedAt).toBeNull();
  });

  it.each([
    ["LEAD", { role: "LEAD" }],
    ["an unknown role", { role: "OWNER" }],
    ["no role", {}],
  ])("returns 400 for %s", async (_label, body) => {
    // Arrange
    const team = await insertTeam();
    await signInAs(team.id, "LEAD");

    // Act
    const res = await createInvite(team.id, body);

    // Assert
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("VALIDATION_ERROR");
    expect(await db.invite.count()).toBe(0);
  });

  it.each(["MEMBER", "INSTRUCTOR"] as const)(
    "returns 403 to a %s and creates nothing",
    async (role) => {
      // Arrange
      const team = await insertTeam();
      await signInAs(team.id, role);

      // Act
      const res = await createInvite(team.id, { role: "MEMBER" });

      // Assert
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({
        error: { code: "FORBIDDEN", message: expect.any(String) },
      });
      expect(await db.invite.count()).toBe(0);
    }
  );

  it("returns 403 to the lead of a different team", async () => {
    // Arrange
    const team = await insertTeam();
    const otherTeam = await insertTeam();
    await signInAs(otherTeam.id, "LEAD");

    // Act
    const res = await createInvite(team.id, { role: "MEMBER" });

    // Assert
    expect(res.status).toBe(403);
    expect(await db.invite.count()).toBe(0);
  });

  it("returns 401 when signed out", async () => {
    // Arrange
    const team = await insertTeam();
    vi.mocked(getSessionUserId).mockResolvedValue(null);

    // Act
    const res = await createInvite(team.id, { role: "MEMBER" });

    // Assert
    expect(res.status).toBe(401);
    expect(await db.invite.count()).toBe(0);
  });
});

describe("DELETE /api/v1/teams/{teamId}/invites/{inviteId}", () => {
  beforeEach(async () => {
    await clearDatabase();
    vi.mocked(getSessionUserId).mockReset();
  });

  it("lets the lead revoke a link", async () => {
    // Arrange
    const team = await insertTeam();
    await signInAs(team.id, "LEAD");
    const invite = await insertInvite({ teamId: team.id, role: "MEMBER" });

    // Act
    const res = await revokeInvite(team.id, invite.id);

    // Assert
    expect(res.status).toBe(204);
    const stored = await db.invite.findUniqueOrThrow({
      where: { id: invite.id },
    });
    expect(stored.revokedAt).toBeInstanceOf(Date);
  });

  it.each(["MEMBER", "INSTRUCTOR"] as const)(
    "returns 403 to a %s and keeps the link working",
    async (role) => {
      // Arrange
      const team = await insertTeam();
      await signInAs(team.id, role);
      const invite = await insertInvite({ teamId: team.id, role: "MEMBER" });

      // Act
      const res = await revokeInvite(team.id, invite.id);

      // Assert
      expect(res.status).toBe(403);
      expect((await res.json()).error.code).toBe("FORBIDDEN");
      const stored = await db.invite.findUniqueOrThrow({
        where: { id: invite.id },
      });
      expect(stored.revokedAt).toBeNull();
    }
  );

  it("returns 404 when the link belongs to another team", async () => {
    // Arrange
    const team = await insertTeam();
    const otherTeam = await insertTeam();
    await signInAs(team.id, "LEAD");
    const otherInvite = await insertInvite({
      teamId: otherTeam.id,
      role: "MEMBER",
    });

    // Act
    const res = await revokeInvite(team.id, otherInvite.id);

    // Assert
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      error: { code: "INVITE_NOT_FOUND", message: expect.any(String) },
    });
    const stored = await db.invite.findUniqueOrThrow({
      where: { id: otherInvite.id },
    });
    expect(stored.revokedAt).toBeNull();
  });

  it("returns 404 for an unknown link", async () => {
    // Arrange
    const team = await insertTeam();
    await signInAs(team.id, "LEAD");

    // Act
    const res = await revokeInvite(team.id, "no-such-invite");

    // Assert
    expect(res.status).toBe(404);
  });

  it("returns 401 when signed out", async () => {
    // Arrange
    const team = await insertTeam();
    const invite = await insertInvite({ teamId: team.id, role: "MEMBER" });
    vi.mocked(getSessionUserId).mockResolvedValue(null);

    // Act
    const res = await revokeInvite(team.id, invite.id);

    // Assert
    expect(res.status).toBe(401);
  });
});
