import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import { getSessionUserId } from "@/server/auth-session";
import { POST } from "@/app/api/v1/memberships/route";
import {
  insertInvite,
  insertMembership,
  insertTeam,
  insertUser,
} from "../../factories/db";
import { apiRequest } from "../helpers/requests";
import { clearDatabase } from "../setup/test-setup";

vi.mock("@/server/auth-session", () => ({ getSessionUserId: vi.fn() }));

function joinWithInvite(inviteToken: string) {
  return POST(apiRequest("POST", "/memberships", { inviteToken }));
}

async function signInAsNewUser() {
  const user = await insertUser();
  vi.mocked(getSessionUserId).mockResolvedValue(user.id);
  return user;
}

describe("POST /api/v1/memberships", () => {
  beforeEach(async () => {
    await clearDatabase();
    vi.mocked(getSessionUserId).mockReset();
  });

  it.each(["MEMBER", "INSTRUCTOR"] as const)(
    "adds the signed-in user to the team with the %s role of the link",
    async (role) => {
      // Arrange
      const team = await insertTeam();
      const invite = await insertInvite({ teamId: team.id, role });
      const user = await signInAsNewUser();

      // Act
      const res = await joinWithInvite(invite.token);

      // Assert
      expect(res.status).toBe(201);
      expect(await res.json()).toEqual({ teamId: team.id, role });
      const membership = await db.membership.findUniqueOrThrow({
        where: { userId_teamId: { userId: user.id, teamId: team.id } },
      });
      expect(membership.role).toBe(role);
    }
  );

  it("lets more than one person join with the same link", async () => {
    // Arrange
    const team = await insertTeam();
    const invite = await insertInvite({ teamId: team.id, role: "MEMBER" });
    await signInAsNewUser();
    await joinWithInvite(invite.token);
    await signInAsNewUser();

    // Act
    const res = await joinWithInvite(invite.token);

    // Assert
    expect(res.status).toBe(201);
    expect(await db.membership.count({ where: { teamId: team.id } })).toBe(2);
  });

  it("doesn't add a second membership when the same link is opened twice", async () => {
    // Arrange
    const team = await insertTeam();
    const invite = await insertInvite({ teamId: team.id, role: "MEMBER" });
    const user = await signInAsNewUser();
    await joinWithInvite(invite.token);

    // Act
    const res = await joinWithInvite(invite.token);

    // Assert
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ teamId: team.id, role: "MEMBER" });
    expect(
      await db.membership.count({
        where: { userId: user.id, teamId: team.id },
      })
    ).toBe(1);
  });

  it.each([
    ["a MEMBER", "MEMBER", "INSTRUCTOR"],
    ["an INSTRUCTOR", "INSTRUCTOR", "MEMBER"],
    ["the LEAD", "LEAD", "MEMBER"],
  ] as const)(
    "keeps %s's role when they open a link for another role",
    async (_label, currentRole, linkRole) => {
      // Arrange
      const team = await insertTeam();
      const invite = await insertInvite({ teamId: team.id, role: linkRole });
      const user = await signInAsNewUser();
      await insertMembership({
        userId: user.id,
        teamId: team.id,
        role: currentRole,
      });

      // Act
      const res = await joinWithInvite(invite.token);

      // Assert
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ teamId: team.id, role: currentRole });
      const memberships = await db.membership.findMany({
        where: { userId: user.id, teamId: team.id },
      });
      expect(memberships).toEqual([
        expect.objectContaining({ role: currentRole }),
      ]);
    }
  );

  it("returns 410 for an expired link and adds no one", async () => {
    // Arrange
    const team = await insertTeam();
    const invite = await insertInvite({
      teamId: team.id,
      role: "MEMBER",
      expiresAt: new Date(Date.now() - 1000),
    });
    await signInAsNewUser();

    // Act
    const res = await joinWithInvite(invite.token);

    // Assert
    expect(res.status).toBe(410);
    expect(await res.json()).toEqual({
      error: {
        code: "INVITE_EXPIRED",
        message:
          "This invite link has expired. Ask your team lead for a new one.",
      },
    });
    expect(await db.membership.count()).toBe(0);
  });

  it.each([
    ["expired", { expiresAt: new Date(Date.now() - 1000) }, "INVITE_EXPIRED"],
    [
      "was revoked",
      { revokedAt: new Date(Date.now() - 1000) },
      "INVITE_REVOKED",
    ],
  ] as const)(
    "sends someone whose instructor link %s to course staff",
    async (_label, overrides, code) => {
      // Arrange: the lead can't create instructor links (decision 006, #116).
      const team = await insertTeam();
      const invite = await insertInvite({
        teamId: team.id,
        role: "INSTRUCTOR",
        ...overrides,
      });
      await signInAsNewUser();

      // Act
      const res = await joinWithInvite(invite.token);

      // Assert
      expect(res.status).toBe(410);
      const body = await res.json();
      expect(body.error.code).toBe(code);
      expect(body.error.message).toMatch(/Ask course staff for a new one\.$/);
      expect(await db.membership.count()).toBe(0);
    }
  );

  it("returns 410 for a revoked link and adds no one", async () => {
    // Arrange
    const team = await insertTeam();
    const invite = await insertInvite({
      teamId: team.id,
      role: "MEMBER",
      revokedAt: new Date(Date.now() - 1000),
    });
    await signInAsNewUser();

    // Act
    const res = await joinWithInvite(invite.token);

    // Assert
    expect(res.status).toBe(410);
    expect(await res.json()).toEqual({
      error: {
        code: "INVITE_REVOKED",
        message:
          "This invite link was revoked. Ask your team lead for a new one.",
      },
    });
    expect(await db.membership.count()).toBe(0);
  });

  it("returns 404 for an unknown link", async () => {
    // Arrange
    await signInAsNewUser();

    // Act
    const res = await joinWithInvite("no-such-token");

    // Assert
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      error: {
        code: "INVITE_NOT_FOUND",
        message:
          "This invite link doesn't work. Check that you copied the whole link, or ask your team lead for a new one.",
      },
    });
    expect(await db.membership.count()).toBe(0);
  });

  it.each([
    ["no token", {}],
    ["an empty token", { inviteToken: "" }],
  ])("returns 400 for %s", async (_label, body) => {
    // Arrange
    await signInAsNewUser();

    // Act
    const res = await POST(apiRequest("POST", "/memberships", body));

    // Assert
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 401 when signed out and adds no one", async () => {
    // Arrange
    const team = await insertTeam();
    const invite = await insertInvite({ teamId: team.id, role: "MEMBER" });
    vi.mocked(getSessionUserId).mockResolvedValue(null);

    // Act
    const res = await joinWithInvite(invite.token);

    // Assert
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("UNAUTHENTICATED");
    expect(await db.membership.count()).toBe(0);
  });
});
