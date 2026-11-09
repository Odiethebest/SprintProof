import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSessionUserId } from "@/server/auth-session";
import { GET } from "@/app/api/v1/teams/[teamId]/sprints/[sprintId]/standups/route";
import {
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

function listStandups({
  teamId,
  sprintId,
  token,
  query = "",
}: {
  teamId: string;
  sprintId: string;
  token: string;
  query?: string;
}) {
  return GET(
    apiGetRequest(`/teams/${teamId}/sprints/${sprintId}/standups${query}`, {
      authorization: bearer(token),
    }),
    routeContext({ teamId, sprintId })
  );
}

async function setUpTeam() {
  const team = await insertTeam();
  const sprint = await insertSprint({
    teamId: team.id,
    name: "Sprint 1",
    startDate: "2026-10-29",
    endDate: "2026-11-04",
  });
  const alice = await insertUser({
    name: "Alice Chen",
    githubLogin: "alice",
    avatarUrl: "https://avatars.githubusercontent.com/u/1",
  });
  const bob = await insertUser({ name: "Bob Diaz", githubLogin: "bob" });
  await insertMembership({ userId: alice.id, teamId: team.id, role: "LEAD" });
  await insertMembership({ userId: bob.id, teamId: team.id, role: "MEMBER" });
  const { token } = await insertApiToken({ userId: bob.id });
  return { team, sprint, alice, bob, token };
}

// One standup a day, posted at 9:00 AM in Los Angeles.
async function postStandupOn(teamId: string, userId: string, date: string) {
  const postedAt = new Date(`${date}T17:00:00Z`);
  return insertStandup({
    teamId,
    userId,
    date,
    createdAt: postedAt,
    updatedAt: postedAt,
  });
}

describe("GET /api/v1/teams/{teamId}/sprints/{sprintId}/standups", () => {
  beforeEach(async () => {
    await clearDatabase();
    vi.mocked(getSessionUserId).mockReset();
    vi.mocked(getSessionUserId).mockResolvedValue(null);
  });

  it("lists the sprint's standups newest first, each with its author", async () => {
    // Arrange
    const { team, sprint, alice, bob, token } = await setUpTeam();
    await postStandupOn(team.id, alice.id, "2026-10-30");
    await postStandupOn(team.id, bob.id, "2026-10-31");
    const newest = await postStandupOn(team.id, alice.id, "2026-11-02");

    // Act
    const res = await listStandups({
      teamId: team.id,
      sprintId: sprint.id,
      token,
    });

    // Assert
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(
      body.data.map(
        (standup: { date: string; author: { githubLogin: string } }) => [
          standup.date,
          standup.author.githubLogin,
        ]
      )
    ).toEqual([
      ["2026-11-02", "alice"],
      ["2026-10-31", "bob"],
      ["2026-10-30", "alice"],
    ]);
    expect(body.data[0]).toEqual({
      id: newest.id,
      sprintId: sprint.id,
      userId: alice.id,
      date: "2026-11-02",
      yesterday: "GitHub sign-in works on preview deploys (#6).",
      today: "Team creation and invite links (#7).",
      blockers: null,
      createdAt: "2026-11-02T17:00:00.000Z",
      updatedAt: "2026-11-02T17:00:00.000Z",
      author: {
        name: "Alice Chen",
        githubLogin: "alice",
        avatarUrl: "https://avatars.githubusercontent.com/u/1",
      },
    });
    expect(body.nextCursor).toBeNull();
  });

  it("leaves out standups from other sprints", async () => {
    // Arrange
    const { team, sprint, alice, token } = await setUpTeam();
    await insertSprint({
      teamId: team.id,
      name: "Sprint 2",
      startDate: "2026-11-05",
      endDate: "2026-11-11",
    });
    await postStandupOn(team.id, alice.id, "2026-11-02");
    await postStandupOn(team.id, alice.id, "2026-11-06");

    // Act
    const res = await listStandups({
      teamId: team.id,
      sprintId: sprint.id,
      token,
    });

    // Assert
    const body = await res.json();
    expect(body.data.map((standup: { date: string }) => standup.date)).toEqual([
      "2026-11-02",
    ]);
  });

  it("returns an empty list for a sprint with no standups", async () => {
    // Arrange
    const { team, sprint, token } = await setUpTeam();

    // Act
    const res = await listStandups({
      teamId: team.id,
      sprintId: sprint.id,
      token,
    });

    // Assert
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: [], nextCursor: null });
  });

  it("returns `limit` standups, then the next ones from the cursor", async () => {
    // Arrange: two standups on Oct 31, so the cursor has to break a tie
    const { team, sprint, alice, bob, token } = await setUpTeam();
    await postStandupOn(team.id, alice.id, "2026-10-30");
    await postStandupOn(team.id, alice.id, "2026-10-31");
    await postStandupOn(team.id, bob.id, "2026-10-31");
    await postStandupOn(team.id, bob.id, "2026-11-02");

    // Act
    const first = await (
      await listStandups({
        teamId: team.id,
        sprintId: sprint.id,
        token,
        query: "?limit=2",
      })
    ).json();
    const second = await (
      await listStandups({
        teamId: team.id,
        sprintId: sprint.id,
        token,
        query: `?limit=2&cursor=${first.nextCursor}`,
      })
    ).json();

    // Assert: every standup once, newest first, across both pages
    expect(first.data).toHaveLength(2);
    expect(first.nextCursor).toBe(first.data[1].id);
    expect(second.data).toHaveLength(2);
    expect(second.nextCursor).toBeNull();
    const pages = [...first.data, ...second.data];
    expect(
      new Set(pages.map((standup: { id: string }) => standup.id)).size
    ).toBe(4);
    expect(pages.map((standup: { date: string }) => standup.date)).toEqual([
      "2026-11-02",
      "2026-10-31",
      "2026-10-31",
      "2026-10-30",
    ]);
  });

  it("returns 400 for a limit over 100", async () => {
    // Arrange
    const { team, sprint, token } = await setUpTeam();

    // Act
    const res = await listStandups({
      teamId: team.id,
      sprintId: sprint.id,
      token,
      query: "?limit=101",
    });

    // Assert
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 INVALID_CURSOR for a cursor from another sprint's list", async () => {
    // Arrange
    const { team, sprint, alice, token } = await setUpTeam();
    await insertSprint({
      teamId: team.id,
      startDate: "2026-11-05",
      endDate: "2026-11-11",
    });
    await postStandupOn(team.id, alice.id, "2026-11-02");
    const elsewhere = await postStandupOn(team.id, alice.id, "2026-11-06");

    // Act
    const res = await listStandups({
      teamId: team.id,
      sprintId: sprint.id,
      token,
      query: `?cursor=${elsewhere.id}`,
    });

    // Assert
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("INVALID_CURSOR");
  });

  it("returns 404 SPRINT_NOT_FOUND for another team's sprint", async () => {
    // Arrange
    const { team, token } = await setUpTeam();
    const otherTeam = await insertTeam();
    const otherSprint = await insertSprint({ teamId: otherTeam.id });

    // Act
    const res = await listStandups({
      teamId: team.id,
      sprintId: otherSprint.id,
      token,
    });

    // Assert
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("SPRINT_NOT_FOUND");
  });
});
