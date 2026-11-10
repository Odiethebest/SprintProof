import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import { getSessionUserId } from "@/server/auth-session";
import { POST as createSprint } from "@/app/api/v1/teams/[teamId]/sprints/route";
import { PATCH as editSprint } from "@/app/api/v1/teams/[teamId]/sprints/[sprintId]/route";
import { GET as listSprintStandups } from "@/app/api/v1/teams/[teamId]/sprints/[sprintId]/standups/route";
import { GET as getSprintSummary } from "@/app/api/v1/teams/[teamId]/sprints/[sprintId]/summary/route";
import { POST as postStandup } from "@/app/api/v1/teams/[teamId]/standups/route";
import {
  insertMembership,
  insertSprint,
  insertStandup,
  insertTeam,
  insertUser,
} from "../../factories/db";
import { apiGetRequest, apiRequest, routeContext } from "../helpers/requests";
import { clearDatabase } from "../setup/test-setup";

vi.mock("@/server/auth-session", () => ({ getSessionUserId: vi.fn() }));
// Live update events are covered in realtime-events.test.ts.
vi.mock("@/server/realtime", () => ({ triggerTeamEvent: vi.fn() }));

// Issue #56: a standup belongs to its team and day, and is listed under the
// sprint whose dates contain that day, so it follows its day when dates change.

// Sprint 1 (Oct 29 – Nov 4) and Sprint 2 (Nov 5 – Nov 11), with the lead
// signed in and one standup of hers on Nov 4, Sprint 1's last day.
async function setUpTwoSprints() {
  const team = await insertTeam({ timezone: "America/Los_Angeles" });
  const sprint1 = await insertSprint({
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
  const lead = await insertUser({ name: "Alice Chen", githubLogin: "alice" });
  await insertMembership({ userId: lead.id, teamId: team.id, role: "LEAD" });
  vi.mocked(getSessionUserId).mockResolvedValue(lead.id);
  const standup = await insertStandup({
    teamId: team.id,
    userId: lead.id,
    date: "2026-11-04",
  });
  return { team, sprint1, sprint2, lead, standup };
}

function changeDates(
  teamId: string,
  sprintId: string,
  dates: { startDate?: string; endDate?: string }
) {
  return editSprint(
    apiRequest("PATCH", `/teams/${teamId}/sprints/${sprintId}`, dates),
    routeContext({ teamId, sprintId })
  );
}

// Takes Nov 4 out of Sprint 1 and adds it to the start of Sprint 2.
async function moveNov4ToSprint2(
  teamId: string,
  sprint1Id: string,
  sprint2Id: string
) {
  expect(
    (await changeDates(teamId, sprint1Id, { endDate: "2026-11-03" })).status
  ).toBe(200);
  expect(
    (await changeDates(teamId, sprint2Id, { startDate: "2026-11-04" })).status
  ).toBe(200);
}

async function standupsListedUnder(teamId: string, sprintId: string) {
  const res = await listSprintStandups(
    apiGetRequest(`/teams/${teamId}/sprints/${sprintId}/standups`),
    routeContext({ teamId, sprintId })
  );
  expect(res.status).toBe(200);
  const body: { data: { id: string; sprintId: string; date: string }[] } =
    await res.json();
  return body.data;
}

async function standupCountIn(teamId: string, sprintId: string) {
  const res = await getSprintSummary(
    apiGetRequest(`/teams/${teamId}/sprints/${sprintId}/summary`),
    routeContext({ teamId, sprintId })
  );
  expect(res.status).toBe(200);
  const body: { members: { standups: { count: number } }[] } = await res.json();
  return body.members[0].standups.count;
}

describe("standups when sprint dates change (#56)", () => {
  beforeEach(async () => {
    await clearDatabase();
    vi.mocked(getSessionUserId).mockReset();
    // Only Date is faked, so the database driver's timers keep running.
    vi.useFakeTimers({ toFake: ["Date"] });
    // Nov 9, 10:00 AM in Los Angeles: during Sprint 2.
    vi.setSystemTime(new Date("2026-11-09T18:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("takes a standup on a day cut from a sprint out of that sprint's standups", async () => {
    // Arrange
    const { team, sprint1 } = await setUpTwoSprints();

    // Act
    const res = await changeDates(team.id, sprint1.id, {
      endDate: "2026-11-03",
    });

    // Assert
    expect(res.status).toBe(200);
    expect(await standupsListedUnder(team.id, sprint1.id)).toEqual([]);
  });

  it("stops counting a standup toward a sprint that no longer covers its day", async () => {
    // Arrange
    const { team, sprint1 } = await setUpTwoSprints();

    // Act
    await changeDates(team.id, sprint1.id, { endDate: "2026-11-03" });

    // Assert
    expect(await standupCountIn(team.id, sprint1.id)).toBe(0);
  });

  it("lists a standup under the sprint whose new dates cover its day", async () => {
    // Arrange
    const { team, sprint1, sprint2, standup } = await setUpTwoSprints();

    // Act
    await moveNov4ToSprint2(team.id, sprint1.id, sprint2.id);

    // Assert
    expect(await standupsListedUnder(team.id, sprint2.id)).toEqual([
      expect.objectContaining({
        id: standup.id,
        sprintId: sprint2.id,
        date: "2026-11-04",
      }),
    ]);
  });

  it("counts a moved standup toward the sprint that now covers its day", async () => {
    // Arrange
    const { team, sprint1, sprint2 } = await setUpTwoSprints();

    // Act
    await moveNov4ToSprint2(team.id, sprint1.id, sprint2.id);

    // Assert
    expect(await standupCountIn(team.id, sprint2.id)).toBe(1);
  });

  it("keeps a standup on a day no sprint covers and lists it again once its sprint covers the day", async () => {
    // Arrange
    const { team, sprint1, standup } = await setUpTwoSprints();
    await changeDates(team.id, sprint1.id, { endDate: "2026-11-03" });

    // Act
    const res = await changeDates(team.id, sprint1.id, {
      endDate: "2026-11-04",
    });

    // Assert
    expect(res.status).toBe(200);
    expect(await db.standup.count()).toBe(1);
    expect(
      (await standupsListedUnder(team.id, sprint1.id)).map(({ id }) => id)
    ).toEqual([standup.id]);
  });

  it("lists standups already posted on a day under a new sprint that covers it", async () => {
    // Arrange: Sprint 2 loses Nov 11, so the standup there is in no sprint
    const { team, sprint2, lead } = await setUpTwoSprints();
    const nov11 = await insertStandup({
      teamId: team.id,
      userId: lead.id,
      date: "2026-11-11",
    });
    await changeDates(team.id, sprint2.id, { endDate: "2026-11-10" });

    // Act
    const res = await createSprint(
      apiRequest("POST", `/teams/${team.id}/sprints`, {
        name: "Sprint 3",
        startDate: "2026-11-11",
        endDate: "2026-11-17",
        standupsPerPerson: 3,
        reviewsPerPerson: 5,
      }),
      routeContext({ teamId: team.id })
    );

    // Assert
    expect(res.status).toBe(201);
    const sprint3: { id: string } = await res.json();
    expect(await standupsListedUnder(team.id, sprint3.id)).toEqual([
      expect.objectContaining({ id: nov11.id, sprintId: sprint3.id }),
    ]);
  });

  // Rule R2: one standup per person per day, even after the day changes sprints.
  it("updates the existing standup when the person posts again on a day that moved to another sprint", async () => {
    // Arrange: Nov 4, 4:00 PM in Los Angeles
    const { team, sprint1, sprint2, lead, standup } = await setUpTwoSprints();
    await moveNov4ToSprint2(team.id, sprint1.id, sprint2.id);
    vi.setSystemTime(new Date("2026-11-05T00:00:00Z"));

    // Act
    const res = await postStandup(
      apiRequest("POST", `/teams/${team.id}/standups`, {
        yesterday: "Reviewed #108.",
        today: "Start the retro board (#13).",
        blockers: "",
      }),
      routeContext({ teamId: team.id })
    );

    // Assert
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      id: standup.id,
      sprintId: sprint2.id,
      date: "2026-11-04",
      today: "Start the retro board (#13).",
    });
    expect(await db.standup.count({ where: { userId: lead.id } })).toBe(1);
  });
});
