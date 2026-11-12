import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import { getSessionUserId } from "@/server/auth-session";
import type { TeamRole } from "@/lib/auth/team-access";
import type { InviteRole } from "@/lib/invites/invite-link";
import { POST } from "@/app/api/v1/teams/[teamId]/invites/route";
import { DELETE } from "@/app/api/v1/teams/[teamId]/invites/[inviteId]/route";
import {
  insertApiToken,
  insertInvite,
  insertMembership,
  insertTeam,
  insertUser,
} from "../../factories/db";
import { apiRequest, bearer, routeContext } from "../helpers/requests";
import { clearDatabase } from "../setup/test-setup";

vi.mock("@/server/auth-session", () => ({ getSessionUserId: vi.fn() }));

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

// Course staff are the GitHub logins in COURSE_STAFF_GITHUB_LOGINS (decision
// 006, #116). The list is written with spaces and in another case on purpose:
// GitHub logins ignore case.
const COURSE_STAFF_LOGIN = "course-ta";
const COURSE_STAFF_GITHUB_LOGINS = "prof-bob, Course-TA";

async function signInAs(teamId: string, role: TeamRole) {
  const user = await insertUser();
  await insertMembership({ userId: user.id, teamId, role });
  vi.mocked(getSessionUserId).mockResolvedValue(user.id);
  return user;
}

// Course staff, on the team with the given role or (null) not on it at all.
async function signInAsCourseStaff(
  membership: { teamId: string; role: TeamRole } | null
) {
  const user = await insertUser({ githubLogin: COURSE_STAFF_LOGIN });
  if (membership !== null) {
    await insertMembership({ userId: user.id, ...membership });
  }
  vi.mocked(getSessionUserId).mockResolvedValue(user.id);
  return user;
}

// Course staff may create and revoke instructor links whatever their role on
// the team, and when they aren't on it at all (null).
const COURSE_STAFF_ROLES = [
  ["course staff who aren't on the team", null],
  ["course staff on the team as a member", "MEMBER"],
  ["course staff who lead the team", "LEAD"],
] as const;

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

async function expectNewInvite(
  res: Response,
  { teamId, role, before }: { teamId: string; role: InviteRole; before: number }
) {
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
  const stored = await db.invite.findUniqueOrThrow({ where: { id: body.id } });
  expect(stored).toMatchObject({
    teamId,
    role,
    token: body.token,
    revokedAt: null,
  });
}

async function expectStillWorking(inviteId: string) {
  const stored = await db.invite.findUniqueOrThrow({
    where: { id: inviteId },
  });
  expect(stored.revokedAt).toBeNull();
}

describe("POST /api/v1/teams/{teamId}/invites", () => {
  beforeEach(async () => {
    await clearDatabase();
    vi.mocked(getSessionUserId).mockReset();
    vi.stubEnv("COURSE_STAFF_GITHUB_LOGINS", COURSE_STAFF_GITHUB_LOGINS);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("lets the lead create a member invite link that expires in 7 days", async () => {
    // Arrange
    const team = await insertTeam();
    await signInAs(team.id, "LEAD");
    const before = Date.now();

    // Act
    const res = await createInvite(team.id, { role: "MEMBER" });

    // Assert
    await expectNewInvite(res, { teamId: team.id, role: "MEMBER", before });
  });

  it.each(COURSE_STAFF_ROLES)(
    "lets %s create an instructor invite link that expires in 7 days",
    async (_label, role) => {
      // Arrange
      const team = await insertTeam();
      await signInAsCourseStaff(role && { teamId: team.id, role });
      const before = Date.now();

      // Act
      const res = await createInvite(team.id, { role: "INSTRUCTOR" });

      // Assert
      await expectNewInvite(res, {
        teamId: team.id,
        role: "INSTRUCTOR",
        before,
      });
    }
  );

  it("lets the team's instructors create an instructor invite link", async () => {
    // Arrange
    const team = await insertTeam();
    await signInAs(team.id, "INSTRUCTOR");
    const before = Date.now();

    // Act
    const res = await createInvite(team.id, { role: "INSTRUCTOR" });

    // Assert
    await expectNewInvite(res, {
      teamId: team.id,
      role: "INSTRUCTOR",
      before,
    });
  });

  it("gives every link a different token", async () => {
    // Arrange: a lead who is also course staff may create both links.
    const team = await insertTeam();
    await signInAsCourseStaff({ teamId: team.id, role: "LEAD" });

    // Act
    const member = await (
      await createInvite(team.id, { role: "MEMBER" })
    ).json();
    const instructor = await (
      await createInvite(team.id, { role: "INSTRUCTOR" })
    ).json();

    // Assert
    expect(member.token).toEqual(expect.any(String));
    expect(instructor.token).toEqual(expect.any(String));
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

  it("revokes the team's previous instructor link when course staff create a new one", async () => {
    // Arrange
    const team = await insertTeam();
    await signInAsCourseStaff(null);
    const oldInstructor = await insertInvite({
      teamId: team.id,
      role: "INSTRUCTOR",
    });
    const member = await insertInvite({ teamId: team.id, role: "MEMBER" });

    // Act
    const res = await createInvite(team.id, { role: "INSTRUCTOR" });

    // Assert
    expect(res.status).toBe(201);
    const oldStored = await db.invite.findUniqueOrThrow({
      where: { id: oldInstructor.id },
    });
    expect(oldStored.revokedAt).toBeInstanceOf(Date);
    await expectStillWorking(member.id);
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
    await expectStillWorking(otherInvite.id);
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

  it("returns 403 to the lead for an instructor link and creates nothing", async () => {
    // Arrange: decision 006, #116: otherwise a lead could join their own team
    // as an instructor with a second account and read peer feedback (PRD R7).
    const team = await insertTeam();
    await signInAs(team.id, "LEAD");

    // Act
    const res = await createInvite(team.id, { role: "INSTRUCTOR" });

    // Assert
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      error: {
        code: "FORBIDDEN",
        message: expect.stringContaining("course staff"),
      },
    });
    expect(await db.invite.count()).toBe(0);
  });

  it.each(["MEMBER", "INSTRUCTOR"] as const)(
    "returns 403 to a MEMBER for a %s link and creates nothing",
    async (linkRole) => {
      // Arrange
      const team = await insertTeam();
      await signInAs(team.id, "MEMBER");

      // Act
      const res = await createInvite(team.id, { role: linkRole });

      // Assert
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual({
        error: { code: "FORBIDDEN", message: expect.any(String) },
      });
      expect(await db.invite.count()).toBe(0);
    }
  );

  it("returns 403 to an INSTRUCTOR for a member link and creates nothing", async () => {
    // Arrange
    const team = await insertTeam();
    await signInAs(team.id, "INSTRUCTOR");

    // Act
    const res = await createInvite(team.id, { role: "MEMBER" });

    // Assert
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("FORBIDDEN");
    expect(await db.invite.count()).toBe(0);
  });

  it("returns 403 to course staff who aren't on the team for a member link", async () => {
    // Arrange
    const team = await insertTeam();
    await signInAsCourseStaff(null);

    // Act
    const res = await createInvite(team.id, { role: "MEMBER" });

    // Assert
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("FORBIDDEN");
    expect(await db.invite.count()).toBe(0);
  });

  it("returns 403 to the instructor of a different team for an instructor link", async () => {
    // Arrange
    const team = await insertTeam();
    const otherTeam = await insertTeam();
    await signInAs(otherTeam.id, "INSTRUCTOR");

    // Act
    const res = await createInvite(team.id, { role: "INSTRUCTOR" });

    // Assert
    expect(res.status).toBe(403);
    expect(await db.invite.count()).toBe(0);
  });

  it.each([
    ["empty", ""],
    ["unset", undefined],
  ])(
    "treats nobody as course staff when COURSE_STAFF_GITHUB_LOGINS is %s",
    async (_label, value) => {
      // Arrange
      vi.stubEnv("COURSE_STAFF_GITHUB_LOGINS", value);
      const team = await insertTeam();
      await signInAsCourseStaff(null);

      // Act
      const res = await createInvite(team.id, { role: "INSTRUCTOR" });

      // Assert
      expect(res.status).toBe(403);
      expect(await db.invite.count()).toBe(0);
    }
  );

  it("treats a lead whose login isn't listed like any other lead", async () => {
    // Arrange
    const team = await insertTeam();
    const lead = await insertUser({ githubLogin: "course-ta-2" });
    await insertMembership({ userId: lead.id, teamId: team.id, role: "LEAD" });
    vi.mocked(getSessionUserId).mockResolvedValue(lead.id);

    // Act
    const res = await createInvite(team.id, { role: "INSTRUCTOR" });

    // Assert
    expect(res.status).toBe(403);
    expect(await db.invite.count()).toBe(0);
  });

  it.each(["missing-team", "bad\u0000id"])(
    "returns 403 to course staff for a team that doesn't exist (%j)",
    async (teamId) => {
      // Arrange: an unknown team is 403 for everyone, as on every other route.
      await signInAsCourseStaff(null);

      // Act
      const res = await createInvite(teamId, { role: "INSTRUCTOR" });

      // Assert
      expect(res.status).toBe(403);
      expect((await res.json()).error.code).toBe("FORBIDDEN");
      expect(await db.invite.count()).toBe(0);
    }
  );

  it("doesn't accept an API token, even from course staff", async () => {
    // Arrange: creating links needs the session; a token only reads (#16).
    const team = await insertTeam();
    const staff = await insertUser({ githubLogin: COURSE_STAFF_LOGIN });
    const { token } = await insertApiToken({ userId: staff.id });
    vi.mocked(getSessionUserId).mockResolvedValue(null);
    const request = new Request(
      `http://localhost:3000/api/v1/teams/${team.id}/invites`,
      {
        method: "POST",
        headers: {
          authorization: bearer(token),
          "content-type": "application/json",
        },
        body: JSON.stringify({ role: "INSTRUCTOR" }),
      }
    );

    // Act
    const res = await POST(request, routeContext({ teamId: team.id }));

    // Assert
    expect(res.status).toBe(401);
    expect(await db.invite.count()).toBe(0);
  });

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
    vi.stubEnv("COURSE_STAFF_GITHUB_LOGINS", COURSE_STAFF_GITHUB_LOGINS);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("lets the lead revoke a member link", async () => {
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

  it.each(COURSE_STAFF_ROLES)(
    "lets %s revoke an instructor link",
    async (_label, role) => {
      // Arrange
      const team = await insertTeam();
      await signInAsCourseStaff(role && { teamId: team.id, role });
      const invite = await insertInvite({
        teamId: team.id,
        role: "INSTRUCTOR",
      });

      // Act
      const res = await revokeInvite(team.id, invite.id);

      // Assert
      expect(res.status).toBe(204);
      const stored = await db.invite.findUniqueOrThrow({
        where: { id: invite.id },
      });
      expect(stored.revokedAt).toBeInstanceOf(Date);
    }
  );

  it("lets the team's instructors revoke an instructor link", async () => {
    // Arrange
    const team = await insertTeam();
    await signInAs(team.id, "INSTRUCTOR");
    const invite = await insertInvite({ teamId: team.id, role: "INSTRUCTOR" });

    // Act
    const res = await revokeInvite(team.id, invite.id);

    // Assert
    expect(res.status).toBe(204);
    const stored = await db.invite.findUniqueOrThrow({
      where: { id: invite.id },
    });
    expect(stored.revokedAt).toBeInstanceOf(Date);
  });

  it("returns 403 to the lead for an instructor link and keeps it working", async () => {
    // Arrange
    const team = await insertTeam();
    await signInAs(team.id, "LEAD");
    const invite = await insertInvite({ teamId: team.id, role: "INSTRUCTOR" });

    // Act
    const res = await revokeInvite(team.id, invite.id);

    // Assert
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      error: {
        code: "FORBIDDEN",
        message: expect.stringContaining("course staff"),
      },
    });
    await expectStillWorking(invite.id);
  });

  it.each(["MEMBER", "INSTRUCTOR"] as const)(
    "returns 403 to a %s for a member link and keeps it working",
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
      await expectStillWorking(invite.id);
    }
  );

  it("returns 403 to a MEMBER for an instructor link and keeps it working", async () => {
    // Arrange
    const team = await insertTeam();
    await signInAs(team.id, "MEMBER");
    const invite = await insertInvite({ teamId: team.id, role: "INSTRUCTOR" });

    // Act
    const res = await revokeInvite(team.id, invite.id);

    // Assert
    expect(res.status).toBe(403);
    await expectStillWorking(invite.id);
  });

  it("returns 403 to course staff who aren't on the team for a member link", async () => {
    // Arrange
    const team = await insertTeam();
    await signInAsCourseStaff(null);
    const invite = await insertInvite({ teamId: team.id, role: "MEMBER" });

    // Act
    const res = await revokeInvite(team.id, invite.id);

    // Assert
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("FORBIDDEN");
    await expectStillWorking(invite.id);
  });

  it("returns 403 to course staff when COURSE_STAFF_GITHUB_LOGINS is empty", async () => {
    // Arrange
    vi.stubEnv("COURSE_STAFF_GITHUB_LOGINS", "");
    const team = await insertTeam();
    await signInAsCourseStaff(null);
    const invite = await insertInvite({ teamId: team.id, role: "INSTRUCTOR" });

    // Act
    const res = await revokeInvite(team.id, invite.id);

    // Assert
    expect(res.status).toBe(403);
    await expectStillWorking(invite.id);
  });

  it("returns 403 to course staff for a team that doesn't exist", async () => {
    // Arrange
    await signInAsCourseStaff(null);

    // Act
    const res = await revokeInvite("missing-team", "some-invite");

    // Assert
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("FORBIDDEN");
  });

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
    await expectStillWorking(otherInvite.id);
  });

  it("returns 404 to course staff when the link belongs to another team", async () => {
    // Arrange
    const team = await insertTeam();
    const otherTeam = await insertTeam();
    await signInAsCourseStaff(null);
    const otherInvite = await insertInvite({
      teamId: otherTeam.id,
      role: "INSTRUCTOR",
    });

    // Act
    const res = await revokeInvite(team.id, otherInvite.id);

    // Assert
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("INVITE_NOT_FOUND");
    await expectStillWorking(otherInvite.id);
  });

  it.each(["no-such-invite", "bad\u0000id"])(
    "returns 404 for an unknown link (%j)",
    async (inviteId) => {
      // Arrange
      const team = await insertTeam();
      await signInAs(team.id, "LEAD");

      // Act
      const res = await revokeInvite(team.id, inviteId);

      // Assert
      expect(res.status).toBe(404);
    }
  );

  it("returns 404 to course staff for an unknown link", async () => {
    // Arrange
    const team = await insertTeam();
    await signInAsCourseStaff(null);

    // Act
    const res = await revokeInvite(team.id, "no-such-invite");

    // Assert
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("INVITE_NOT_FOUND");
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
