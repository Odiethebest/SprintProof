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
} from "../../factories/db";
import { clearDatabase } from "../setup/test-setup";

async function teamWithSprint() {
  const team = await insertTeam();
  const sprint = await insertSprint({
    teamId: team.id,
    startDate: "2026-10-29",
    endDate: "2026-11-04",
  });
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
        sprintId: sprint.id,
        userId: user.id,
        date: "2026-11-03",
        ...standupFields,
      });

      // Assert
      expect(isNew).toBe(true);
      expect(standup.date).toBe("2026-11-03");
      expect(standup.updatedAt).toEqual(standup.createdAt);
    });

    // A double-clicked "Post standup" sends two requests at once (rule R2).
    it("stores one standup when the same person saves twice at the same moment", async () => {
      // Arrange
      const { sprint, user } = await teamWithSprint();
      const key = { sprintId: sprint.id, userId: user.id, date: "2026-11-03" };

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
  });

  describe("findStandup", () => {
    it("returns the person's standup for that sprint and date", async () => {
      // Arrange
      const { sprint, user } = await teamWithSprint();
      const stored = await insertStandup({
        sprintId: sprint.id,
        userId: user.id,
        date: "2026-11-03",
        blockers: "Waiting on #107.",
      });

      // Act
      const standup = await findStandup({
        sprintId: sprint.id,
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
      const { sprint, user } = await teamWithSprint();
      await insertStandup({
        sprintId: sprint.id,
        userId: user.id,
        date: "2026-11-02",
      });

      // Act
      const standup = await findStandup({
        sprintId: sprint.id,
        userId: user.id,
        date: "2026-11-03",
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
        sprintId: sprint.id,
        userId: teammate.id,
        date: "2026-11-03",
      });

      // Act
      const standup = await findStandup({
        sprintId: sprint.id,
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
      const { sprint, user } = await teamWithSprint();
      const stored = await insertStandup({
        sprintId: sprint.id,
        userId: user.id,
        date: "2026-11-03",
      });

      // Act
      const standups = await listSprintStandups({ sprintId: sprint.id });

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

    it("leaves out standups from the team's other sprints and from other teams", async () => {
      // Arrange
      const { team, sprint, user } = await teamWithSprint();
      const nextSprint = await insertSprint({
        teamId: team.id,
        startDate: "2026-11-05",
        endDate: "2026-11-11",
      });
      const otherTeam = await insertTeam();
      const otherSprint = await insertSprint({
        teamId: otherTeam.id,
        startDate: "2026-10-29",
        endDate: "2026-11-04",
      });
      const inSprint = await insertStandup({
        sprintId: sprint.id,
        userId: user.id,
        date: "2026-11-03",
      });
      await insertStandup({
        sprintId: nextSprint.id,
        userId: user.id,
        date: "2026-11-05",
      });
      await insertStandup({
        sprintId: otherSprint.id,
        userId: user.id,
        date: "2026-11-03",
      });

      // Act
      const standups = await listSprintStandups({ sprintId: sprint.id });

      // Assert
      expect(standups.map((standup) => standup.id)).toEqual([inSprint.id]);
    });

    it("returns an empty list for a sprint with no standups", async () => {
      // Arrange
      const { sprint } = await teamWithSprint();

      // Act
      const standups = await listSprintStandups({ sprintId: sprint.id });

      // Assert
      expect(standups).toEqual([]);
    });
  });
});
