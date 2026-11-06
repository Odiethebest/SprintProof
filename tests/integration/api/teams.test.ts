import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import { getSessionUserId } from "@/server/auth-session";
import { POST } from "@/app/api/v1/teams/route";
import { insertTeam, insertUser } from "../../factories/db";
import { apiRequest } from "../helpers/requests";
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
