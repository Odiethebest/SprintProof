import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import { getSessionUserId } from "@/server/auth-session";
import { GET, POST } from "@/app/api/v1/teams/route";
import {
  insertApiToken,
  insertMembership,
  insertTeam,
  insertUser,
} from "../../factories/db";
import { apiGetRequest, apiRequest, bearer } from "../helpers/requests";
import { clearDatabase } from "../setup/test-setup";

// Auth.js reads the session from request cookies; mock the one session wrapper.
vi.mock("@/server/auth-session", () => ({ getSessionUserId: vi.fn() }));

function createTeam(body: unknown) {
  return POST(apiRequest("POST", "/teams", body));
}

async function signInAsNewUser() {
  const user = await insertUser();
  vi.mocked(getSessionUserId).mockResolvedValue(user.id);
  return user;
}

describe("POST /api/v1/teams", () => {
  beforeEach(async () => {
    await clearDatabase();
    vi.mocked(getSessionUserId).mockReset();
  });

  it("creates a team with its name, repo and timezone", async () => {
    // Arrange
    await signInAsNewUser();

    // Act
    const res = await createTeam({
      name: "SprintProof",
      repoFullName: "Odiethebest/SprintProof",
      timezone: "America/New_York",
    });

    // Assert
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toEqual({
      id: expect.any(String),
      name: "SprintProof",
      repoFullName: "Odiethebest/SprintProof",
      timezone: "America/New_York",
    });
    const team = await db.team.findUniqueOrThrow({ where: { id: body.id } });
    expect(team).toMatchObject({
      name: "SprintProof",
      repoFullName: "Odiethebest/SprintProof",
      timezone: "America/New_York",
    });
  });

  it("makes the creator the team's LEAD and its only member", async () => {
    // Arrange
    const user = await signInAsNewUser();

    // Act
    const res = await createTeam({
      name: "SprintProof",
      repoFullName: "Odiethebest/SprintProof",
    });

    // Assert
    const { id: teamId } = await res.json();
    const memberships = await db.membership.findMany({ where: { teamId } });
    expect(memberships).toEqual([
      expect.objectContaining({ userId: user.id, role: "LEAD" }),
    ]);
  });

  it("defaults the timezone to America/Los_Angeles", async () => {
    // Arrange
    await signInAsNewUser();

    // Act
    const res = await createTeam({
      name: "SprintProof",
      repoFullName: "Odiethebest/SprintProof",
    });

    // Assert
    expect(res.status).toBe(201);
    expect((await res.json()).timezone).toBe("America/Los_Angeles");
  });

  it.each([
    ["a repo that isn't owner/name", { repoFullName: "SprintProof" }],
    ["an unknown timezone", { timezone: "Mars/Olympus" }],
    ["a blank name", { name: "   " }],
  ])("returns 400 for %s and creates nothing", async (_label, override) => {
    // Arrange
    await signInAsNewUser();

    // Act
    const res = await createTeam({
      name: "SprintProof",
      repoFullName: "Odiethebest/SprintProof",
      ...override,
    });

    // Assert
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: { code: "VALIDATION_ERROR", message: expect.any(String) },
    });
    expect(await db.team.count()).toBe(0);
  });

  it("returns 400 when the body isn't JSON", async () => {
    // Arrange
    await signInAsNewUser();
    const request = new Request("http://localhost:3000/api/v1/teams", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not json",
    });

    // Act
    const res = await POST(request);

    // Assert
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 409 when another team already connected the repo, whatever its case", async () => {
    // Arrange
    await insertTeam({ repoFullName: "Odiethebest/SprintProof" });
    await signInAsNewUser();

    // Act
    const res = await createTeam({
      name: "Copy",
      repoFullName: "odiethebest/sprintproof",
    });

    // Assert
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: { code: "REPO_ALREADY_CONNECTED", message: expect.any(String) },
    });
    expect(await db.team.count()).toBe(1);
  });

  it("returns 401 when signed out and creates nothing", async () => {
    // Arrange
    vi.mocked(getSessionUserId).mockResolvedValue(null);

    // Act
    const res = await createTeam({
      name: "SprintProof",
      repoFullName: "Odiethebest/SprintProof",
    });

    // Assert
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      error: { code: "UNAUTHENTICATED", message: expect.any(String) },
    });
    expect(await db.team.count()).toBe(0);
  });
});

function listTeams(query = "", authorization?: string) {
  return GET(apiGetRequest(`/teams${query}`, { authorization }));
}

// One user on three teams, joined in a different order than the teams were
// created and than their roles sort, and a fourth team they aren't on.
async function setUpTeams() {
  const user = await insertUser();
  const led = await insertTeam({
    name: "SprintProof",
    repoFullName: "Odiethebest/SprintProof",
    timezone: "America/Los_Angeles",
  });
  const joined = await insertTeam({
    name: "Course site",
    repoFullName: "cs-course/site",
    timezone: "America/New_York",
  });
  const taught = await insertTeam({
    name: "Section 2",
    repoFullName: "cs-course/section-2",
    timezone: "UTC",
  });
  const other = await insertTeam({ name: "Someone else's team" });
  await insertMembership({
    userId: user.id,
    teamId: joined.id,
    role: "MEMBER",
    createdAt: new Date("2026-10-27T17:00:00Z"),
  });
  await insertMembership({
    userId: user.id,
    teamId: led.id,
    role: "LEAD",
    createdAt: new Date("2026-10-28T17:00:00Z"),
  });
  await insertMembership({
    userId: user.id,
    teamId: taught.id,
    role: "INSTRUCTOR",
    createdAt: new Date("2026-10-29T17:00:00Z"),
  });
  return { user, led, joined, taught, other };
}

describe("GET /api/v1/teams", () => {
  beforeEach(async () => {
    await clearDatabase();
    vi.mocked(getSessionUserId).mockReset();
    vi.mocked(getSessionUserId).mockResolvedValue(null);
  });

  it("lists the caller's teams with their role, in the order they joined", async () => {
    // Arrange
    const { user, led, joined, taught } = await setUpTeams();
    vi.mocked(getSessionUserId).mockResolvedValue(user.id);

    // Act
    const res = await listTeams();

    // Assert: never the team they aren't on
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      data: [
        {
          id: joined.id,
          name: "Course site",
          repoFullName: "cs-course/site",
          timezone: "America/New_York",
          role: "MEMBER",
        },
        {
          id: led.id,
          name: "SprintProof",
          repoFullName: "Odiethebest/SprintProof",
          timezone: "America/Los_Angeles",
          role: "LEAD",
        },
        {
          id: taught.id,
          name: "Section 2",
          repoFullName: "cs-course/section-2",
          timezone: "UTC",
          role: "INSTRUCTOR",
        },
      ],
      nextCursor: null,
    });
  });

  it("returns an empty list to a user who isn't on any team", async () => {
    // Arrange
    await insertTeam();
    const user = await insertUser();
    vi.mocked(getSessionUserId).mockResolvedValue(user.id);

    // Act
    const res = await listTeams();

    // Assert
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: [], nextCursor: null });
  });

  it("lists the token owner's teams, not the signed-in user's, when a request sends both", async () => {
    // Arrange: signed in as a user on three teams, with another user's token
    const { user } = await setUpTeams();
    const tokenOwner = await insertUser();
    const ownTeam = await insertTeam();
    await insertMembership({
      userId: tokenOwner.id,
      teamId: ownTeam.id,
      role: "MEMBER",
    });
    const { token } = await insertApiToken({ userId: tokenOwner.id });
    vi.mocked(getSessionUserId).mockResolvedValue(user.id);

    // Act
    const res = await listTeams("", bearer(token));

    // Assert
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.map((team: { id: string }) => team.id)).toEqual([
      ownTeam.id,
    ]);
  });

  it("returns `limit` teams, then the next ones from the cursor", async () => {
    // Arrange
    const { user, led, joined, taught } = await setUpTeams();
    vi.mocked(getSessionUserId).mockResolvedValue(user.id);

    // Act
    const first = await (await listTeams("?limit=2")).json();
    const second = await (
      await listTeams(`?limit=2&cursor=${first.nextCursor}`)
    ).json();

    // Assert
    expect(first.data.map((team: { id: string }) => team.id)).toEqual([
      joined.id,
      led.id,
    ]);
    expect(first.nextCursor).toBe(led.id);
    expect(second.data.map((team: { id: string }) => team.id)).toEqual([
      taught.id,
    ]);
    expect(second.nextCursor).toBeNull();
  });

  it.each(["0", "101", "ten"])(
    "returns 400 for a limit of %s",
    async (limit) => {
      // Arrange
      const { user } = await setUpTeams();
      vi.mocked(getSessionUserId).mockResolvedValue(user.id);

      // Act
      const res = await listTeams(`?limit=${limit}`);

      // Assert
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        error: {
          code: "VALIDATION_ERROR",
          message: "Set limit to a whole number from 1 to 100.",
        },
      });
    }
  );

  it("returns 400 INVALID_CURSOR for a cursor from a team the caller isn't on", async () => {
    // Arrange
    const { user, other } = await setUpTeams();
    vi.mocked(getSessionUserId).mockResolvedValue(user.id);

    // Act
    const res = await listTeams(`?cursor=${other.id}`);

    // Assert
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: {
        code: "INVALID_CURSOR",
        message:
          "This cursor isn't from this list. Use the nextCursor from the previous page.",
      },
    });
  });

  it("returns 400 INVALID_CURSOR for a cursor that doesn't exist", async () => {
    // Arrange
    const { user } = await setUpTeams();
    vi.mocked(getSessionUserId).mockResolvedValue(user.id);

    // Act
    const res = await listTeams("?cursor=no-such-team");

    // Assert
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("INVALID_CURSOR");
  });
});
