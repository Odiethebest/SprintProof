import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import {
  findStandup,
  listSprintStandups,
  saveStandup,
} from "@/server/repositories/standups";
import {
  insertMembership,
  insertSprint,
  insertStandup,
  insertTeam,
  insertUser,
  toStandupSprint,
} from "../../factories/db";
import { clearDatabase } from "../setup/test-setup";

async function teamWithSprint() {
  const team = await insertTeam();
  const sprint = toStandupSprint(
    await insertSprint({
      teamId: team.id,
      startDate: "2026-10-29",
      endDate: "2026-11-04",
    })
  );
  const user = await insertUser({
    githubLogin: "Odiethebest",
    name: "Ziqi (Odie) Yang",
    avatarUrl: "https://avatars.githubusercontent.com/u/1",
  });
  await insertMembership({ userId: user.id, teamId: team.id, role: "LEAD" });
  return { team, sprint, user };
}

const standupFields = {
  yesterday: "Wrote the PRD.",
  today: "Open the PR.",
  blockers: null,
};

describe("standups repository", () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  describe("saveStandup", () => {
    it("gives a new standup the same createdAt and updatedAt, so it doesn't show as edited", async () => {
      // Arrange
      const { sprint, user } = await teamWithSprint();

      // Act
      const { standup, isNew } = await saveStandup({
        sprint,
        userId: user.id,
        date: "2026-11-03",
        ...standupFields,
      });

      // Assert
      expect(isNew).toBe(true);
      expect(standup.sprintId).toBe(sprint.id);
      expect(standup.date).toBe("2026-11-03");
      expect(standup.updatedAt).toEqual(standup.createdAt);
    });

    // A double-clicked "Post standup" sends two requests at once (rule R2).
    it("stores one standup when the same person saves twice at the same moment", async () => {
      // Arrange
      const { sprint, user } = await teamWithSprint();
      const key = { sprint, userId: user.id, date: "2026-11-03" };

      // Act
      const results = await Promise.all([
        saveStandup({ ...key, ...standupFields, today: "First" }),
        saveStandup({ ...key, ...standupFields, today: "Second" }),
      ]);

      // Assert
      expect(results.map((result) => result.isNew).sort()).toEqual([
        false,
        true,
      ]);
      expect(await db.standup.count()).toBe(1);
    });

    it("keeps a separate standup for each team the person posts to on the same day", async () => {
      // Arrange
      const { sprint, user } = await teamWithSprint();
      const otherTeam = await insertTeam();
      await insertMembership({
        userId: user.id,
        teamId: otherTeam.id,
        role: "MEMBER",
      });
      const otherSprint = toStandupSprint(
        await insertSprint({
          teamId: otherTeam.id,
          startDate: "2026-10-29",
          endDate: "2026-11-04",
        })
      );
      const day = { userId: user.id, date: "2026-11-03", ...standupFields };

      // Act
      const first = await saveStandup({ sprint, ...day });
      const second = await saveStandup({ sprint: otherSprint, ...day });

      // Assert
      expect([first.isNew, second.isNew]).toEqual([true, true]);
      expect(await db.standup.count()).toBe(2);
    });
  });

  // Rule R2, enforced by the database too: one standup per person per team per day.
  describe("uniqueness", () => {
    it("rejects a second standup for the same person, team and day", async () => {
      // Arrange
      const { team, user } = await teamWithSprint();
      await insertStandup({
        teamId: team.id,
        userId: user.id,
        date: "2026-11-03",
      });

      // Act
      const second = insertStandup({
        teamId: team.id,
        userId: user.id,
        date: "2026-11-03",
      });

      // Assert
      await expect(second).rejects.toThrow();
      expect(await db.standup.count()).toBe(1);
    });
  });

  describe("findStandup", () => {
    it("returns the person's standup for that day, listed under the sprint", async () => {
      // Arrange
      const { team, sprint, user } = await teamWithSprint();
      const stored = await insertStandup({
        teamId: team.id,
        userId: user.id,
        date: "2026-11-03",
        blockers: "Waiting on #107.",
      });

      // Act
      const standup = await findStandup({
        sprint,
        userId: user.id,
        date: "2026-11-03",
      });

      // Assert
      expect(standup).toEqual({
        id: stored.id,
        sprintId: sprint.id,
        userId: user.id,
        date: "2026-11-03",
        yesterday: stored.yesterday,
        today: stored.today,
        blockers: "Waiting on #107.",
        createdAt: stored.createdAt,
        updatedAt: stored.updatedAt,
      });
    });

    it("returns null when the person hasn't posted that day", async () => {
      // Arrange
      const { team, sprint, user } = await teamWithSprint();
      await insertStandup({
        teamId: team.id,
        userId: user.id,
        date: "2026-11-02",
      });

      // Act
      const standup = await findStandup({
        sprint,
        userId: user.id,
        date: "2026-11-03",
      });

      // Assert
      expect(standup).toBeNull();
    });

    it("returns null for a day outside the sprint's dates", async () => {
      // Arrange
      const { team, sprint, user } = await teamWithSprint();
      await insertStandup({
        teamId: team.id,
        userId: user.id,
        date: "2026-11-05",
      });

      // Act
      const standup = await findStandup({
        sprint,
        userId: user.id,
        date: "2026-11-05",
      });

      // Assert
      expect(standup).toBeNull();
    });

    it("doesn't return a teammate's standup", async () => {
      // Arrange
      const { team, sprint, user } = await teamWithSprint();
      const teammate = await insertUser();
      await insertMembership({
        userId: teammate.id,
        teamId: team.id,
        role: "MEMBER",
      });
      await insertStandup({
        teamId: team.id,
        userId: teammate.id,
        date: "2026-11-03",
      });

      // Act
      const standup = await findStandup({
        sprint,
        userId: user.id,
        date: "2026-11-03",
      });

      // Assert
      expect(standup).toBeNull();
    });
  });

  describe("listSprintStandups", () => {
    it("returns the sprint's standups with each author's name, login and avatar", async () => {
      // Arrange
      const { team, sprint, user } = await teamWithSprint();
      const stored = await insertStandup({
        teamId: team.id,
        userId: user.id,
        date: "2026-11-03",
      });

      // Act
      const standups = await listSprintStandups({ sprint });

      // Assert
      expect(standups).toEqual([
        {
          id: stored.id,
          sprintId: sprint.id,
          userId: user.id,
          date: "2026-11-03",
          yesterday: stored.yesterday,
          today: stored.today,
          blockers: null,
          createdAt: stored.createdAt,
          updatedAt: stored.updatedAt,
          author: {
            name: "Ziqi (Odie) Yang",
            githubLogin: "Odiethebest",
            avatarUrl: "https://avatars.githubusercontent.com/u/1",
          },
        },
      ]);
    });

    it("includes standups on the sprint's first and last days and leaves out the days around it", async () => {
      // Arrange: Sprint 1 runs Oct 29 – Nov 4
      const { team, sprint, user } = await teamWithSprint();
      for (const date of [
        "2026-10-28",
        "2026-10-29",
        "2026-11-04",
        "2026-11-05",
      ]) {
        await insertStandup({ teamId: team.id, userId: user.id, date });
      }

      // Act
      const standups = await listSprintStandups({ sprint });

      // Assert
      expect(standups.map((standup) => standup.date)).toEqual([
        "2026-11-04",
        "2026-10-29",
      ]);
    });

    it("leaves out standups from the team's other sprints and from other teams", async () => {
      // Arrange
      const { team, sprint, user } = await teamWithSprint();
      await insertSprint({
        teamId: team.id,
        startDate: "2026-11-05",
        endDate: "2026-11-11",
      });
      const otherTeam = await insertTeam();
      await insertSprint({
        teamId: otherTeam.id,
        startDate: "2026-10-29",
        endDate: "2026-11-04",
      });
      const inSprint = await insertStandup({
        teamId: team.id,
        userId: user.id,
        date: "2026-11-03",
      });
      await insertStandup({
        teamId: team.id,
        userId: user.id,
        date: "2026-11-05",
      });
      await insertStandup({
        teamId: otherTeam.id,
        userId: user.id,
        date: "2026-11-03",
      });

      // Act
      const standups = await listSprintStandups({ sprint });

      // Assert
      expect(standups.map((standup) => standup.id)).toEqual([inSprint.id]);
    });

    it("returns an empty list for a sprint with no standups", async () => {
      // Arrange
      const { sprint } = await teamWithSprint();

      // Act
      const standups = await listSprintStandups({ sprint });

      // Assert
      expect(standups).toEqual([]);
    });
  });
});
