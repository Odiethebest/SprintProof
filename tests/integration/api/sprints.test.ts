import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import { getSessionUserId } from "@/server/auth-session";
import type { TeamRole } from "@/lib/auth/team-access";
import { GET, POST } from "@/app/api/v1/teams/[teamId]/sprints/route";
import { PATCH } from "@/app/api/v1/teams/[teamId]/sprints/[sprintId]/route";
import {
  insertMembership,
  insertSprint,
  insertTeam,
  insertUser,
} from "../../factories/db";
import { apiRequest, routeContext } from "../helpers/requests";
import { clearDatabase } from "../setup/test-setup";

vi.mock("@/server/auth-session", () => ({ getSessionUserId: vi.fn() }));

async function signInAs(teamId: string, role: TeamRole) {
  const user = await insertUser();
  await insertMembership({ userId: user.id, teamId, role });
  vi.mocked(getSessionUserId).mockResolvedValue(user.id);
  return user;
}

function createSprint(teamId: string, body: unknown) {
  return POST(
    apiRequest("POST", `/teams/${teamId}/sprints`, body),
    routeContext({ teamId })
  );
}

function listSprints(teamId: string, query = "") {
  return GET(
    apiRequest("GET", `/teams/${teamId}/sprints${query}`),
    routeContext({ teamId })
  );
}

function editSprint(teamId: string, sprintId: string, body: unknown) {
  return PATCH(
    apiRequest("PATCH", `/teams/${teamId}/sprints/${sprintId}`, body),
    routeContext({ teamId, sprintId })
  );
}

describe("POST /api/v1/teams/{teamId}/sprints", () => {
  beforeEach(async () => {
    await clearDatabase();
    vi.mocked(getSessionUserId).mockReset();
  });

  it("lets the lead create a sprint with default standups (3) and reviews (5)", async () => {
    // Arrange
    const team = await insertTeam();
    await signInAs(team.id, "LEAD");

    // Act
    const res = await createSprint(team.id, {
      name: "Sprint 1",
      startDate: "2026-10-29",
      endDate: "2026-11-04",
    });

    // Assert
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toMatchObject({
      id: expect.any(String),
      teamId: team.id,
      name: "Sprint 1",
      startDate: "2026-10-29",
      endDate: "2026-11-04",
      standupsPerPerson: 3,
      reviewsPerPerson: 5,
    });
    const stored = await db.sprint.findUniqueOrThrow({
      where: { id: body.id },
    });
    expect(stored.name).toBe("Sprint 1");
    expect(stored.standupsPerPerson).toBe(3);
    expect(stored.reviewsPerPerson).toBe(5);
  });

  it("lets the lead specify custom requirements", async () => {
    // Arrange
    const team = await insertTeam();
    await signInAs(team.id, "LEAD");

    // Act
    const res = await createSprint(team.id, {
      name: "Sprint 1",
      startDate: "2026-10-29",
      endDate: "2026-11-04",
      standupsPerPerson: 4,
      reviewsPerPerson: 7,
    });

    // Assert
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.standupsPerPerson).toBe(4);
    expect(body.reviewsPerPerson).toBe(7);
  });

  it("returns 400 when endDate is before startDate with clear error", async () => {
    // Arrange
    const team = await insertTeam();
    await signInAs(team.id, "LEAD");

    // Act
    const res = await createSprint(team.id, {
      name: "Invalid sprint",
      startDate: "2026-11-04",
      endDate: "2026-10-29",
    });

    // Assert
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "End date cannot be before start date.",
      },
    });
    expect(await db.sprint.count()).toBe(0);
  });

  it("returns 400 when sprint dates overlap an existing sprint in the same team", async () => {
    // Arrange
    const team = await insertTeam();
    await signInAs(team.id, "LEAD");
    await insertSprint({
      teamId: team.id,
      name: "Sprint 1",
      startDate: "2026-10-29",
      endDate: "2026-11-04",
    });

    // Act
    const res = await createSprint(team.id, {
      name: "Sprint 2 Overlapping",
      startDate: "2026-11-03",
      endDate: "2026-11-10",
    });

    // Assert
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: 'Dates overlap with existing sprint "Sprint 1".',
      },
    });
    expect(await db.sprint.count()).toBe(1);
  });

  it("allows overlapping dates with a sprint in a different team", async () => {
    // Arrange
    const team = await insertTeam();
    const otherTeam = await insertTeam();
    await signInAs(team.id, "LEAD");
    await insertSprint({
      teamId: otherTeam.id,
      name: "Sprint 1 Other Team",
      startDate: "2026-10-29",
      endDate: "2026-11-04",
    });

    // Act
    const res = await createSprint(team.id, {
      name: "Sprint 1",
      startDate: "2026-10-29",
      endDate: "2026-11-04",
    });

    // Assert
    expect(res.status).toBe(201);
  });

  it.each([
    ["a blank name", { name: "   " }],
    ["an invalid start date format", { startDate: "not-a-date" }],
    ["an invalid end date format", { endDate: "2026-02-30" }],
    ["standupsPerPerson below 1", { standupsPerPerson: 0 }],
    ["standupsPerPerson above 20", { standupsPerPerson: 21 }],
    ["reviewsPerPerson below 1", { reviewsPerPerson: 0 }],
    ["reviewsPerPerson above 20", { reviewsPerPerson: 25 }],
  ])("returns 400 for %s and creates nothing", async (_label, override) => {
    // Arrange
    const team = await insertTeam();
    await signInAs(team.id, "LEAD");

    // Act
    const res = await createSprint(team.id, {
      name: "Sprint 1",
      startDate: "2026-10-29",
      endDate: "2026-11-04",
      ...override,
    });

    // Assert
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: { code: "VALIDATION_ERROR", message: expect.any(String) },
    });
    expect(await db.sprint.count()).toBe(0);
  });

  it.each([
    ["a name that isn't text", { name: 42 }, "Sprint name must be text."],
    [
      "a start date that isn't a string",
      { startDate: 20261029 },
      "Start date must be a valid calendar date in YYYY-MM-DD format.",
    ],
    [
      "standups per person sent as a string",
      { standupsPerPerson: "5" },
      "Standups per person must be an integer.",
    ],
    [
      "reviews per person sent as null",
      { reviewsPerPerson: null },
      "Reviews per person must be an integer.",
    ],
  ])(
    "returns 400 for %s with its message and creates nothing",
    async (_label, override, message) => {
      // Arrange
      const team = await insertTeam();
      await signInAs(team.id, "LEAD");

      // Act
      const res = await createSprint(team.id, {
        name: "Sprint 1",
        startDate: "2026-10-29",
        endDate: "2026-11-04",
        ...override,
      });

      // Assert
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        error: { code: "VALIDATION_ERROR", message },
      });
      expect(await db.sprint.count()).toBe(0);
    }
  );

  it("returns 400 asking for a name when it is missing", async () => {
    // Arrange
    const team = await insertTeam();
    await signInAs(team.id, "LEAD");

    // Act
    const res = await createSprint(team.id, {
      startDate: "2026-10-29",
      endDate: "2026-11-04",
    });

    // Assert
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: { code: "VALIDATION_ERROR", message: "Sprint name is required." },
    });
  });

  it("creates the sprint in the URL's team even if the body names another", async () => {
    // Arrange
    const team = await insertTeam();
    const otherTeam = await insertTeam();
    await signInAs(team.id, "LEAD");

    // Act
    const res = await createSprint(team.id, {
      name: "Sprint 1",
      startDate: "2026-10-29",
      endDate: "2026-11-04",
      teamId: otherTeam.id,
    });

    // Assert
    expect(res.status).toBe(201);
    expect(await db.sprint.count({ where: { teamId: team.id } })).toBe(1);
    expect(await db.sprint.count({ where: { teamId: otherTeam.id } })).toBe(0);
  });

  it("returns 400 when the body isn't JSON", async () => {
    // Arrange
    const team = await insertTeam();
    await signInAs(team.id, "LEAD");
    const request = new Request(`http://localhost:3000/api/v1/teams/${team.id}/sprints`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not json",
    });

    // Act
    const res = await POST(request, routeContext({ teamId: team.id }));

    // Assert
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("VALIDATION_ERROR");
  });

  it.each(["MEMBER", "INSTRUCTOR"] as const)(
    "returns 403 to a %s and creates nothing",
    async (role) => {
      // Arrange
      const team = await insertTeam();
      await signInAs(team.id, role);

      // Act
      const res = await createSprint(team.id, {
        name: "Sprint 1",
        startDate: "2026-10-29",
        endDate: "2026-11-04",
      });

      // Assert
      expect(res.status).toBe(403);
      expect((await res.json()).error.code).toBe("FORBIDDEN");
      expect(await db.sprint.count()).toBe(0);
    }
  );

  // Not on the team is treated like a wrong role: 403 either way (#6).
  it("returns 403 to a user outside the team", async () => {
    // Arrange
    const team = await insertTeam();
    const outsider = await insertUser();
    vi.mocked(getSessionUserId).mockResolvedValue(outsider.id);

    // Act
    const res = await createSprint(team.id, {
      name: "Sprint 1",
      startDate: "2026-10-29",
      endDate: "2026-11-04",
    });

    // Assert
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("FORBIDDEN");
    expect(await db.sprint.count()).toBe(0);
  });

  it("returns 401 when signed out", async () => {
    // Arrange
    const team = await insertTeam();
    vi.mocked(getSessionUserId).mockResolvedValue(null);

    // Act
    const res = await createSprint(team.id, {
      name: "Sprint 1",
      startDate: "2026-10-29",
      endDate: "2026-11-04",
    });

    // Assert
    expect(res.status).toBe(401);
    expect(await db.sprint.count()).toBe(0);
  });
});

describe("GET /api/v1/teams/{teamId}/sprints", () => {
  beforeEach(async () => {
    await clearDatabase();
    vi.mocked(getSessionUserId).mockReset();
  });

  it.each(["LEAD", "MEMBER", "INSTRUCTOR"] as const)(
    "lets a %s view the sprint list",
    async (role) => {
      // Arrange
      const team = await insertTeam();
      await signInAs(team.id, role);
      await insertSprint({
        teamId: team.id,
        name: "Sprint 1",
        startDate: "2026-10-29",
        endDate: "2026-11-04",
      });

      // Act
      const res = await listSprints(team.id);

      // Assert
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0]).toMatchObject({
        name: "Sprint 1",
        startDate: "2026-10-29",
        endDate: "2026-11-04",
      });
    }
  );

  it("returns sprints sorted by start date ascending", async () => {
    // Arrange
    const team = await insertTeam();
    await signInAs(team.id, "MEMBER");
    await insertSprint({
      teamId: team.id,
      name: "Sprint 2",
      startDate: "2026-11-05",
      endDate: "2026-11-11",
    });
    await insertSprint({
      teamId: team.id,
      name: "Sprint 1",
      startDate: "2026-10-29",
      endDate: "2026-11-04",
    });

    // Act
    const res = await listSprints(team.id);

    // Assert
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(2);
    expect(body.data[0].name).toBe("Sprint 1");
    expect(body.data[1].name).toBe("Sprint 2");
  });

  it("returns 403 to a user outside the team", async () => {
    // Arrange
    const team = await insertTeam();
    const outsider = await insertUser();
    vi.mocked(getSessionUserId).mockResolvedValue(outsider.id);

    // Act
    const res = await listSprints(team.id);

    // Assert
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("FORBIDDEN");
  });

  it("returns 401 when signed out", async () => {
    // Arrange
    const team = await insertTeam();
    vi.mocked(getSessionUserId).mockResolvedValue(null);

    // Act
    const res = await listSprints(team.id);

    // Assert
    expect(res.status).toBe(401);
  });
});

// Cursor pagination: ?limit= (1–100, default 20) and ?cursor= (AGENTS.md §1 API response shape).
describe("GET /api/v1/teams/{teamId}/sprints pagination", () => {
  beforeEach(async () => {
    await clearDatabase();
    vi.mocked(getSessionUserId).mockReset();
  });

  async function insertWeeklySprints(teamId: string, count: number) {
    const sprints = [];
    for (let week = 0; week < count; week++) {
      const start = new Date(Date.UTC(2026, 9, 29 + week * 7));
      const end = new Date(Date.UTC(2026, 9, 29 + week * 7 + 6));
      sprints.push(
        await insertSprint({
          teamId,
          name: `Sprint ${week + 1}`,
          startDate: start,
          endDate: end,
        })
      );
    }
    return sprints;
  }

  it("returns a null nextCursor when every sprint fits on one page", async () => {
    // Arrange
    const team = await insertTeam();
    await signInAs(team.id, "MEMBER");
    await insertWeeklySprints(team.id, 2);

    // Act
    const res = await listSprints(team.id);

    // Assert
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(2);
    expect(body.nextCursor).toBeNull();
  });

  it("returns 20 sprints by default and a cursor for the rest", async () => {
    // Arrange
    const team = await insertTeam();
    await signInAs(team.id, "MEMBER");
    await insertWeeklySprints(team.id, 21);

    // Act
    const res = await listSprints(team.id);

    // Assert
    const body = await res.json();
    expect(body.data).toHaveLength(20);
    expect(body.nextCursor).toBe(body.data[19].id);
  });

  it("returns `limit` sprints, then the next ones from the cursor", async () => {
    // Arrange
    const team = await insertTeam();
    await signInAs(team.id, "MEMBER");
    await insertWeeklySprints(team.id, 3);

    // Act
    const first = await (await listSprints(team.id, "?limit=2")).json();
    const second = await (
      await listSprints(team.id, `?limit=2&cursor=${first.nextCursor}`)
    ).json();

    // Assert
    expect(first.data.map((sprint: { name: string }) => sprint.name)).toEqual([
      "Sprint 1",
      "Sprint 2",
    ]);
    expect(first.nextCursor).toBe(first.data[1].id);
    expect(second.data.map((sprint: { name: string }) => sprint.name)).toEqual([
      "Sprint 3",
    ]);
    expect(second.nextCursor).toBeNull();
  });

  it.each(["0", "101", "ten"])(
    "returns 400 for a limit of %s",
    async (limit) => {
      // Arrange
      const team = await insertTeam();
      await signInAs(team.id, "MEMBER");

      // Act
      const res = await listSprints(team.id, `?limit=${limit}`);

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

  it("returns 400 INVALID_CURSOR for a cursor from another team's list", async () => {
    // Arrange
    const team = await insertTeam();
    const otherTeam = await insertTeam();
    await signInAs(team.id, "MEMBER");
    await insertWeeklySprints(team.id, 1);
    const [otherSprint] = await insertWeeklySprints(otherTeam.id, 1);

    // Act
    const res = await listSprints(team.id, `?cursor=${otherSprint.id}`);

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
    const team = await insertTeam();
    await signInAs(team.id, "MEMBER");
    await insertWeeklySprints(team.id, 1);

    // Act
    const res = await listSprints(team.id, "?cursor=no-such-sprint");

    // Assert
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("INVALID_CURSOR");
  });
});

describe("PATCH /api/v1/teams/{teamId}/sprints/{sprintId}", () => {
  beforeEach(async () => {
    await clearDatabase();
    vi.mocked(getSessionUserId).mockReset();
  });

  it("lets the lead edit a sprint's name, dates and quotas", async () => {
    // Arrange
    const team = await insertTeam();
    await signInAs(team.id, "LEAD");
    const sprint = await insertSprint({
      teamId: team.id,
      name: "Sprint 1",
      startDate: "2026-10-29",
      endDate: "2026-11-04",
      standupsPerPerson: 3,
      reviewsPerPerson: 5,
    });

    // Act
    const res = await editSprint(team.id, sprint.id, {
      name: "Sprint 1 (Updated)",
      startDate: "2026-10-30",
      endDate: "2026-11-04",
      standupsPerPerson: 4,
      reviewsPerPerson: 6,
    });

    // Assert
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      id: sprint.id,
      name: "Sprint 1 (Updated)",
      startDate: "2026-10-30",
      endDate: "2026-11-04",
      standupsPerPerson: 4,
      reviewsPerPerson: 6,
    });
    const stored = await db.sprint.findUniqueOrThrow({
      where: { id: sprint.id },
    });
    expect(stored.name).toBe("Sprint 1 (Updated)");
  });

  it("does not trigger self-overlap error when editing an existing sprint", async () => {
    // Arrange
    const team = await insertTeam();
    await signInAs(team.id, "LEAD");
    const sprint = await insertSprint({
      teamId: team.id,
      name: "Sprint 1",
      startDate: "2026-10-29",
      endDate: "2026-11-04",
    });

    // Act
    const res = await editSprint(team.id, sprint.id, {
      name: "Sprint 1 Renamed",
      startDate: "2026-10-29",
      endDate: "2026-11-04",
      standupsPerPerson: 3,
      reviewsPerPerson: 5,
    });

    // Assert
    expect(res.status).toBe(200);
  });

  it("returns 400 when editing to overlap a different sprint", async () => {
    // Arrange
    const team = await insertTeam();
    await signInAs(team.id, "LEAD");
    await insertSprint({
      teamId: team.id,
      name: "Sprint 1",
      startDate: "2026-10-29",
      endDate: "2026-11-04",
    });
    const sprint2 = await insertSprint({
      teamId: team.id,
      name: "Sprint 2",
      startDate: "2026-11-05",
      endDate: "2026-11-11",
    });

    // Act
    const res = await editSprint(team.id, sprint2.id, {
      name: "Sprint 2 Extended",
      startDate: "2026-11-04", // overlaps Sprint 1's end date
      endDate: "2026-11-11",
      standupsPerPerson: 3,
      reviewsPerPerson: 5,
    });

    // Assert
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: 'Dates overlap with existing sprint "Sprint 1".',
      },
    });
  });

  it.each([
    ["a name that isn't text", { name: 123 }, "Sprint name must be text."],
    [
      "a null start date",
      { startDate: null },
      "Start date must be a valid calendar date in YYYY-MM-DD format.",
    ],
    [
      "an end date sent as a number",
      { endDate: 20261110 },
      "End date must be a valid calendar date in YYYY-MM-DD format.",
    ],
    [
      "standups per person sent as a string",
      { standupsPerPerson: "4" },
      "Standups per person must be an integer.",
    ],
  ])(
    "returns 400 for %s and leaves the sprint unchanged",
    async (_label, body, message) => {
      // Arrange
      const team = await insertTeam();
      await signInAs(team.id, "LEAD");
      const sprint = await insertSprint({
        teamId: team.id,
        name: "Sprint 1",
        startDate: "2026-10-29",
        endDate: "2026-11-04",
        standupsPerPerson: 3,
      });

      // Act
      const res = await editSprint(team.id, sprint.id, body);

      // Assert
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        error: { code: "VALIDATION_ERROR", message },
      });
      const stored = await db.sprint.findUniqueOrThrow({
        where: { id: sprint.id },
      });
      expect(stored.name).toBe("Sprint 1");
      expect(stored.standupsPerPerson).toBe(3);
      expect(stored.startDate.toISOString().slice(0, 10)).toBe("2026-10-29");
      expect(stored.endDate.toISOString().slice(0, 10)).toBe("2026-11-04");
    }
  );

  it("keeps the fields a partial edit doesn't send", async () => {
    // Arrange
    const team = await insertTeam();
    await signInAs(team.id, "LEAD");
    const sprint = await insertSprint({
      teamId: team.id,
      name: "Sprint 1",
      startDate: "2026-10-29",
      endDate: "2026-11-04",
      standupsPerPerson: 4,
      reviewsPerPerson: 6,
    });

    // Act
    const res = await editSprint(team.id, sprint.id, {
      name: "Sprint 1 (Renamed)",
    });

    // Assert
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      name: "Sprint 1 (Renamed)",
      startDate: "2026-10-29",
      endDate: "2026-11-04",
      standupsPerPerson: 4,
      reviewsPerPerson: 6,
    });
  });

  it.each(["MEMBER", "INSTRUCTOR"] as const)(
    "returns 403 to a %s when editing",
    async (role) => {
      // Arrange
      const team = await insertTeam();
      await signInAs(team.id, role);
      const sprint = await insertSprint({ teamId: team.id });

      // Act
      const res = await editSprint(team.id, sprint.id, {
        name: "Hacked Sprint",
        startDate: "2026-10-29",
        endDate: "2026-11-04",
        standupsPerPerson: 1,
        reviewsPerPerson: 1,
      });

      // Assert
      expect(res.status).toBe(403);
      expect((await res.json()).error.code).toBe("FORBIDDEN");
    }
  );

  it("returns 404 for an unknown sprint id", async () => {
    // Arrange
    const team = await insertTeam();
    await signInAs(team.id, "LEAD");

    // Act
    const res = await editSprint(team.id, "nonexistent-sprint", {
      name: "Updated",
      startDate: "2026-10-29",
      endDate: "2026-11-04",
      standupsPerPerson: 3,
      reviewsPerPerson: 5,
    });

    // Assert
    expect(res.status).toBe(404);
  });

  it("returns 404 when sprint belongs to a different team", async () => {
    // Arrange
    const team = await insertTeam();
    const otherTeam = await insertTeam();
    await signInAs(team.id, "LEAD");
    const otherSprint = await insertSprint({ teamId: otherTeam.id });

    // Act
    const res = await editSprint(team.id, otherSprint.id, {
      name: "Updated",
      startDate: "2026-10-29",
      endDate: "2026-11-04",
      standupsPerPerson: 3,
      reviewsPerPerson: 5,
    });

    // Assert
    expect(res.status).toBe(404);
  });

  it("returns 403 to an outsider", async () => {
    // Arrange
    const team = await insertTeam();
    const sprint = await insertSprint({ teamId: team.id });
    const outsider = await insertUser();
    vi.mocked(getSessionUserId).mockResolvedValue(outsider.id);

    // Act
    const res = await editSprint(team.id, sprint.id, {
      name: "Updated",
      startDate: "2026-10-29",
      endDate: "2026-11-04",
      standupsPerPerson: 3,
      reviewsPerPerson: 5,
    });

    // Assert
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("FORBIDDEN");
  });

  it("returns 401 when signed out", async () => {
    // Arrange
    const team = await insertTeam();
    const sprint = await insertSprint({ teamId: team.id });
    vi.mocked(getSessionUserId).mockResolvedValue(null);

    // Act
    const res = await editSprint(team.id, sprint.id, {
      name: "Updated",
      startDate: "2026-10-29",
      endDate: "2026-11-04",
      standupsPerPerson: 3,
      reviewsPerPerson: 5,
    });

    // Assert
    expect(res.status).toBe(401);
  });
});
