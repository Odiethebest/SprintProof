import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSessionUserId } from "@/server/auth-session";
import { GET } from "@/app/api/v1/teams/[teamId]/sprints/[sprintId]/summary/route";
import {
  insertActivity,
  insertApiToken,
  insertMembership,
  insertSprint,
  insertStandup,
  insertTeam,
  insertUser,
} from "../../factories/db";
import { apiGetRequest, bearer, routeContext } from "../helpers/requests";
import { clearDatabase } from "../setup/test-setup";

vi.mock("@/server/auth-session", () => ({ getSessionUserId: vi.fn() }));

// Nov 2, 10:00 AM in Los Angeles: inside Sprint 1 (Oct 29 – Nov 4).
const IN_SPRINT = new Date("2026-11-02T18:00:00Z");

function getSummary({
  teamId,
  sprintId,
  token,
}: {
  teamId: string;
  sprintId: string;
  token: string;
}) {
  return GET(
    apiGetRequest(`/teams/${teamId}/sprints/${sprintId}/summary`, {
      authorization: bearer(token),
    }),
    routeContext({ teamId, sprintId })
  );
}

// Alice (lead) and Bob (member) with some work in Sprint 1, and an instructor.
async function setUpSprint() {
  const team = await insertTeam({ timezone: "America/Los_Angeles" });
  const sprint = await insertSprint({
    teamId: team.id,
    name: "Sprint 1",
    startDate: "2026-10-29",
    endDate: "2026-11-04",
    standupsPerPerson: 3,
    reviewsPerPerson: 5,
  });
  const alice = await insertUser({ name: "Alice Chen", githubLogin: "alice" });
  const bob = await insertUser({ name: "Bob Diaz", githubLogin: "bob" });
  const carol = await insertUser({ name: "Carol TA", githubLogin: "carol" });
  await insertMembership({ userId: alice.id, teamId: team.id, role: "LEAD" });
  await insertMembership({ userId: bob.id, teamId: team.id, role: "MEMBER" });
  await insertMembership({
    userId: carol.id,
    teamId: team.id,
    role: "INSTRUCTOR",
  });

  for (const [userId, date] of [
    [alice.id, "2026-10-30"],
    [alice.id, "2026-10-31"],
    [bob.id, "2026-11-02"],
  ] as const) {
    const postedAt = new Date(`${date}T17:00:00Z`);
    await insertStandup({
      teamId: team.id,
      userId,
      date,
      createdAt: postedAt,
      updatedAt: postedAt,
    });
  }
  await insertActivity({
    teamId: team.id,
    type: "COMMIT",
    actorLogin: "alice",
    sha: "a1",
    occurredAt: IN_SPRINT,
  });
  await insertActivity({
    teamId: team.id,
    type: "COMMIT",
    actorLogin: "alice",
    sha: "a2",
    occurredAt: IN_SPRINT,
  });
  await insertActivity({
    teamId: team.id,
    type: "PR_OPENED",
    actorLogin: "alice",
    prNumber: 12,
    prAuthorLogin: "alice",
    occurredAt: IN_SPRINT,
  });
  await insertActivity({
    teamId: team.id,
    type: "REVIEW",
    actorLogin: "bob",
    prNumber: 12,
    prAuthorLogin: "alice",
    occurredAt: IN_SPRINT,
  });
  // Nov 5 in Los Angeles: after the sprint, so it isn't counted.
  await insertActivity({
    teamId: team.id,
    type: "COMMIT",
    actorLogin: "bob",
    sha: "b1",
    occurredAt: new Date("2026-11-05T18:00:00Z"),
  });

  return { team, sprint, alice, bob, carol };
}

describe("GET /api/v1/teams/{teamId}/sprints/{sprintId}/summary", () => {
  beforeEach(async () => {
    await clearDatabase();
    vi.mocked(getSessionUserId).mockReset();
    vi.mocked(getSessionUserId).mockResolvedValue(null);
    // Only Date is faked, so the database driver's timers keep running.
    vi.useFakeTimers({ toFake: ["Date"] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the sprint, when the counts were taken and each member's counts", async () => {
    // Arrange: Nov 3, noon in Los Angeles, 2 days left
    const { team, sprint, alice, bob } = await setUpSprint();
    const { token } = await insertApiToken({ userId: bob.id });
    vi.setSystemTime(new Date("2026-11-03T20:00:00Z"));

    // Act
    const res = await getSummary({
      teamId: team.id,
      sprintId: sprint.id,
      token,
    });

    // Assert: the instructor has no requirements, so isn't listed
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      sprint: {
        id: sprint.id,
        name: "Sprint 1",
        startDate: "2026-10-29",
        endDate: "2026-11-04",
        standupsPerPerson: 3,
        reviewsPerPerson: 5,
        state: "CURRENT",
        daysLeft: 2,
      },
      countsAsOf: "2026-11-03T20:00:00.000Z",
      members: [
        {
          userId: alice.id,
          name: "Alice Chen",
          githubLogin: "alice",
          role: "LEAD",
          commits: 2,
          pullRequests: 1,
          standups: { count: 2, required: 3, remaining: 1, status: "AT_RISK" },
          reviews: { count: 0, required: 5, remaining: 5, status: "AT_RISK" },
        },
        {
          userId: bob.id,
          name: "Bob Diaz",
          githubLogin: "bob",
          role: "MEMBER",
          commits: 0,
          pullRequests: 0,
          standups: { count: 1, required: 3, remaining: 2, status: "AT_RISK" },
          reviews: { count: 1, required: 5, remaining: 4, status: "AT_RISK" },
        },
      ],
    });
  });

  it("marks open requirements MISSED after the sprint has ended", async () => {
    // Arrange: Nov 6 in Los Angeles
    const { team, sprint, carol } = await setUpSprint();
    const { token } = await insertApiToken({ userId: carol.id });
    vi.setSystemTime(new Date("2026-11-06T20:00:00Z"));

    // Act
    const res = await getSummary({
      teamId: team.id,
      sprintId: sprint.id,
      token,
    });

    // Assert
    const body = await res.json();
    expect(body.sprint).toMatchObject({ state: "ENDED", daysLeft: 0 });
    expect(
      body.members.map(
        (member: {
          standups: { status: string };
          reviews: { status: string };
        }) => [member.standups.status, member.reviews.status]
      )
    ).toEqual([
      ["MISSED", "MISSED"],
      ["MISSED", "MISSED"],
    ]);
  });

  it("returns 404 SPRINT_NOT_FOUND for a sprint that doesn't exist", async () => {
    // Arrange
    const { team, bob } = await setUpSprint();
    const { token } = await insertApiToken({ userId: bob.id });

    // Act
    const res = await getSummary({
      teamId: team.id,
      sprintId: "no-such-sprint",
      token,
    });

    // Assert
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      error: { code: "SPRINT_NOT_FOUND", message: "Sprint not found." },
    });
  });

  it("returns 404 SPRINT_NOT_FOUND for another team's sprint", async () => {
    // Arrange
    const { team, bob } = await setUpSprint();
    const otherTeam = await insertTeam();
    const otherSprint = await insertSprint({ teamId: otherTeam.id });
    const { token } = await insertApiToken({ userId: bob.id });

    // Act
    const res = await getSummary({
      teamId: team.id,
      sprintId: otherSprint.id,
      token,
    });

    // Assert
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("SPRINT_NOT_FOUND");
  });
});
