import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import { getSessionUserId } from "@/server/auth-session";
import type { TeamRole } from "@/lib/auth/team-access";
import { POST } from "@/app/api/v1/teams/[teamId]/standups/route";
import {
  insertMembership,
  insertSprint,
  insertTeam,
  insertUser,
} from "../../factories/db";
import { apiRequest, routeContext } from "../helpers/requests";
import { clearDatabase } from "../setup/test-setup";

vi.mock("@/server/auth-session", () => ({ getSessionUserId: vi.fn() }));
// Live update events are covered in realtime-events.test.ts.
vi.mock("@/server/realtime", () => ({ triggerTeamEvent: vi.fn() }));

const NO_CURRENT_SPRINT = {
  error: {
    code: "NO_CURRENT_SPRINT",
    message: "Today isn't in any sprint. A lead can add one in Settings.",
  },
};

const standupBody = {
  yesterday: "GitHub sign-in works on preview deploys (#6).",
  today: "Team creation and invite links (#7).",
  blockers: "Waiting on reviews for #107 and #108.",
};

async function signInAs(teamId: string, role: TeamRole) {
  const user = await insertUser();
  await insertMembership({ userId: user.id, teamId, role });
  vi.mocked(getSessionUserId).mockResolvedValue(user.id);
  return user;
}

function postStandup(teamId: string, body: unknown) {
  return POST(
    apiRequest("POST", `/teams/${teamId}/standups`, body),
    routeContext({ teamId })
  );
}

function setNow(instant: string) {
  vi.setSystemTime(new Date(instant));
}

describe("POST /api/v1/teams/{teamId}/standups", () => {
  beforeEach(async () => {
    await clearDatabase();
    vi.mocked(getSessionUserId).mockReset();
    // Only Date is faked, so the database driver's timers keep running.
    vi.useFakeTimers({ toFake: ["Date"] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("rejects a form from yesterday without saving and accepts today's formDate", async () => {
    const team = await insertTeam();
    await insertSprint({ teamId: team.id });
    await signInAs(team.id, "MEMBER");
    setNow("2026-11-03T08:05:00Z");
    const stale = await postStandup(team.id, {
      ...standupBody,
      formDate: "2026-11-02",
    });
    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({
      error: { code: "STANDUP_DAY_CHANGED" },
    });
    expect(await db.standup.count()).toBe(0);
    const current = await postStandup(team.id, {
      ...standupBody,
      formDate: "2026-11-03",
    });
    expect(current.status).toBe(201);
  });

  describe("create", () => {
    it.each(["MEMBER", "LEAD"] as const)(
      "files a %s's standup under the current sprint and today's date",
      async (role) => {
        // Arrange: 9:05 AM PST on Tue, Nov 3, inside Sprint 1 (Oct 29 – Nov 4)
        const team = await insertTeam({ timezone: "America/Los_Angeles" });
        const sprint = await insertSprint({
          teamId: team.id,
          startDate: "2026-10-29",
          endDate: "2026-11-04",
        });
        const user = await signInAs(team.id, role);
        setNow("2026-11-03T17:05:00.000Z");

        // Act
        const res = await postStandup(team.id, standupBody);

        // Assert
        expect(res.status).toBe(201);
        expect(await res.json()).toMatchObject({
          id: expect.any(String),
          sprintId: sprint.id,
          userId: user.id,
          date: "2026-11-03",
          ...standupBody,
        });
        const stored = await db.standup.findMany();
        expect(stored).toHaveLength(1);
        expect(stored[0].date.toISOString()).toBe("2026-11-03T00:00:00.000Z");
      }
    );

    it("stores empty blockers as null", async () => {
      // Arrange
      const team = await insertTeam();
      await insertSprint({ teamId: team.id });
      await signInAs(team.id, "MEMBER");
      setNow("2026-11-03T17:05:00.000Z");

      // Act
      const res = await postStandup(team.id, { ...standupBody, blockers: "" });

      // Assert
      expect(res.status).toBe(201);
      expect((await res.json()).blockers).toBeNull();
    });

    it("picks the sprint that contains today, not the team's other sprints", async () => {
      // Arrange: Nov 6 falls in Sprint 2
      const team = await insertTeam();
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
      await signInAs(team.id, "MEMBER");
      setNow("2026-11-06T17:00:00.000Z");

      // Act
      const res = await postStandup(team.id, standupBody);

      // Assert
      expect(res.status).toBe(201);
      expect((await res.json()).sprintId).toBe(sprint2.id);
    });

    it("dates the standup in the team timezone, not UTC", async () => {
      // Arrange: 8 PM PST on Nov 3 is already Nov 4 in UTC
      const team = await insertTeam({ timezone: "America/Los_Angeles" });
      await insertSprint({ teamId: team.id });
      await signInAs(team.id, "MEMBER");
      setNow("2026-11-04T04:00:00.000Z");

      // Act
      const res = await postStandup(team.id, standupBody);

      // Assert
      expect((await res.json()).date).toBe("2026-11-03");
    });

    it("files a standup posted late on the sprint's last day under that sprint", async () => {
      // Arrange: 11:30 PM PST on Nov 4, Sprint 1's end date
      const team = await insertTeam({ timezone: "America/Los_Angeles" });
      const sprint = await insertSprint({
        teamId: team.id,
        startDate: "2026-10-29",
        endDate: "2026-11-04",
      });
      await signInAs(team.id, "MEMBER");
      setNow("2026-11-05T07:30:00.000Z");

      // Act
      const res = await postStandup(team.id, standupBody);

      // Assert
      expect(res.status).toBe(201);
      expect(await res.json()).toMatchObject({
        sprintId: sprint.id,
        date: "2026-11-04",
      });
    });

    // The server picks the sprint and the date (rule R2).
    it("ignores a sprintId, date or userId sent by the client", async () => {
      // Arrange
      const team = await insertTeam();
      const current = await insertSprint({
        teamId: team.id,
        startDate: "2026-10-29",
        endDate: "2026-11-04",
      });
      const upcoming = await insertSprint({
        teamId: team.id,
        startDate: "2026-11-05",
        endDate: "2026-11-11",
      });
      const teammate = await insertUser();
      await insertMembership({
        userId: teammate.id,
        teamId: team.id,
        role: "MEMBER",
      });
      const user = await signInAs(team.id, "MEMBER");
      setNow("2026-11-03T17:05:00.000Z");

      // Act
      const res = await postStandup(team.id, {
        ...standupBody,
        sprintId: upcoming.id,
        date: "2026-11-06",
        userId: teammate.id,
      });

      // Assert
      expect(res.status).toBe(201);
      expect(await res.json()).toMatchObject({
        sprintId: current.id,
        userId: user.id,
        date: "2026-11-03",
      });
    });
  });

  // Rule R2: at most one standup per person per day (team timezone).
  describe("same-day update", () => {
    it("updates the standup already posted today instead of adding a second one", async () => {
      // Arrange: posted at 9:05 AM PST, saved again at 4:30 PM PST
      const team = await insertTeam({ timezone: "America/Los_Angeles" });
      await insertSprint({ teamId: team.id });
      await signInAs(team.id, "MEMBER");
      setNow("2026-11-03T17:05:00.000Z");
      const first = await (await postStandup(team.id, standupBody)).json();
      setNow("2026-11-04T00:30:00.000Z");

      // Act
      const res = await postStandup(team.id, {
        yesterday: standupBody.yesterday,
        today: "Review #108, then start the standup form (#9).",
        blockers: standupBody.blockers,
      });

      // Assert
      expect(res.status).toBe(200);
      const updated = await res.json();
      expect(updated).toMatchObject({
        id: first.id,
        date: "2026-11-03",
        today: "Review #108, then start the standup form (#9).",
        createdAt: first.createdAt,
      });
      expect(updated.updatedAt).toBe("2026-11-04T00:30:00.000Z");
      expect(await db.standup.count()).toBe(1);
    });

    it("clears blockers when the update leaves them empty", async () => {
      // Arrange
      const team = await insertTeam();
      await insertSprint({ teamId: team.id });
      await signInAs(team.id, "MEMBER");
      setNow("2026-11-03T17:05:00.000Z");
      await postStandup(team.id, standupBody);

      // Act
      const res = await postStandup(team.id, {
        yesterday: standupBody.yesterday,
        today: standupBody.today,
      });

      // Assert
      expect(res.status).toBe(200);
      expect((await res.json()).blockers).toBeNull();
    });

    it("adds a new standup the next day", async () => {
      // Arrange: Nov 3 at 9:05 AM PST, then Nov 4 at 12:05 AM PST
      const team = await insertTeam({ timezone: "America/Los_Angeles" });
      await insertSprint({ teamId: team.id });
      await signInAs(team.id, "MEMBER");
      setNow("2026-11-03T17:05:00.000Z");
      const first = await (await postStandup(team.id, standupBody)).json();
      setNow("2026-11-04T08:05:00.000Z");

      // Act
      const res = await postStandup(team.id, standupBody);

      // Assert
      expect(res.status).toBe(201);
      const second = await res.json();
      expect(second.id).not.toBe(first.id);
      expect(second.date).toBe("2026-11-04");
      expect(await db.standup.count()).toBe(2);
    });

    it("keeps a teammate's standup from the same day separate", async () => {
      // Arrange
      const team = await insertTeam();
      await insertSprint({ teamId: team.id });
      await signInAs(team.id, "MEMBER");
      setNow("2026-11-03T17:05:00.000Z");
      await postStandup(team.id, standupBody);
      await signInAs(team.id, "MEMBER");

      // Act
      const res = await postStandup(team.id, standupBody);

      // Assert
      expect(res.status).toBe(201);
      expect(await db.standup.count()).toBe(2);
    });
  });

  describe("no current sprint", () => {
    it("returns 409 NO_CURRENT_SPRINT when the team has no sprints", async () => {
      // Arrange
      const team = await insertTeam();
      await signInAs(team.id, "MEMBER");
      setNow("2026-11-03T17:05:00.000Z");

      // Act
      const res = await postStandup(team.id, standupBody);

      // Assert
      expect(res.status).toBe(409);
      expect(await res.json()).toEqual(NO_CURRENT_SPRINT);
      expect(await db.standup.count()).toBe(0);
    });

    it.each([
      ["has ended", "2026-11-05T08:00:00.000Z"],
      ["hasn't started", "2026-10-29T06:59:59.999Z"],
    ])("returns 409 when the only sprint %s", async (_label, instant) => {
      // Arrange: Sprint 1 runs Oct 29 – Nov 4 in Los Angeles time
      const team = await insertTeam({ timezone: "America/Los_Angeles" });
      await insertSprint({
        teamId: team.id,
        startDate: "2026-10-29",
        endDate: "2026-11-04",
      });
      await signInAs(team.id, "MEMBER");
      setNow(instant);

      // Act
      const res = await postStandup(team.id, standupBody);

      // Assert
      expect(res.status).toBe(409);
      expect(await res.json()).toEqual(NO_CURRENT_SPRINT);
      expect(await db.standup.count()).toBe(0);
    });
  });

  describe("validation", () => {
    it("returns 400 with the field's message and stores nothing", async () => {
      // Arrange
      const team = await insertTeam();
      await insertSprint({ teamId: team.id });
      await signInAs(team.id, "MEMBER");
      setNow("2026-11-03T17:05:00.000Z");

      // Act
      const res = await postStandup(team.id, {
        ...standupBody,
        yesterday: " ",
      });

      // Assert
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        error: {
          code: "VALIDATION_ERROR",
          message: "Add what you worked on yesterday.",
        },
      });
      expect(await db.standup.count()).toBe(0);
    });

    it("returns 400 when a field is over 1000 characters", async () => {
      // Arrange
      const team = await insertTeam();
      await insertSprint({ teamId: team.id });
      await signInAs(team.id, "MEMBER");
      setNow("2026-11-03T17:05:00.000Z");

      // Act
      const res = await postStandup(team.id, {
        ...standupBody,
        today: "a".repeat(1001),
      });

      // Assert
      expect(res.status).toBe(400);
      expect((await res.json()).error.message).toBe(
        "Use 1000 characters or fewer."
      );
    });
  });

  describe("access", () => {
    // Not on the team is treated like a wrong role: 403 either way (#6).
    it("returns 403 to a user outside the team and stores nothing", async () => {
      // Arrange
      const team = await insertTeam();
      await insertSprint({ teamId: team.id });
      const outsider = await insertUser();
      vi.mocked(getSessionUserId).mockResolvedValue(outsider.id);
      setNow("2026-11-03T17:05:00.000Z");

      // Act
      const res = await postStandup(team.id, standupBody);

      // Assert
      expect(res.status).toBe(403);
      expect((await res.json()).error.code).toBe("FORBIDDEN");
      expect(await db.standup.count()).toBe(0);
    });

    it("returns 403 to a member of another team", async () => {
      // Arrange
      const team = await insertTeam();
      await insertSprint({ teamId: team.id });
      const otherTeam = await insertTeam();
      await signInAs(otherTeam.id, "MEMBER");
      setNow("2026-11-03T17:05:00.000Z");

      // Act
      const res = await postStandup(team.id, standupBody);

      // Assert
      expect(res.status).toBe(403);
      expect(await db.standup.count()).toBe(0);
    });

    // Instructors read the team's standups but don't post their own (AGENTS.md §2, screen 3).
    it("returns 403 to an instructor", async () => {
      // Arrange
      const team = await insertTeam();
      await insertSprint({ teamId: team.id });
      await signInAs(team.id, "INSTRUCTOR");
      setNow("2026-11-03T17:05:00.000Z");

      // Act
      const res = await postStandup(team.id, standupBody);

      // Assert
      expect(res.status).toBe(403);
      expect(await db.standup.count()).toBe(0);
    });

    it("returns 401 when signed out", async () => {
      // Arrange
      const team = await insertTeam();
      await insertSprint({ teamId: team.id });
      vi.mocked(getSessionUserId).mockResolvedValue(null);
      setNow("2026-11-03T17:05:00.000Z");

      // Act
      const res = await postStandup(team.id, standupBody);

      // Assert
      expect(res.status).toBe(401);
      expect((await res.json()).error.code).toBe("UNAUTHENTICATED");
      expect(await db.standup.count()).toBe(0);
    });
  });
});
