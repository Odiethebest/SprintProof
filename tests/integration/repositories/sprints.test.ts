import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import {
  createSprint,
  findSprintById,
  listSprints,
  updateSprint,
} from "@/server/repositories/sprints";
import { insertSprint, insertTeam } from "../../factories/db";
import { clearDatabase } from "../setup/test-setup";

describe("sprints repository", () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  describe("createSprint", () => {
    it("creates a sprint and returns dates formatted as YYYY-MM-DD strings", async () => {
      // Arrange
      const team = await insertTeam();

      // Act
      const sprint = await createSprint({
        teamId: team.id,
        name: "Sprint 1",
        startDate: "2026-10-29",
        endDate: "2026-11-04",
        standupsPerPerson: 3,
        reviewsPerPerson: 5,
      });

      // Assert
      expect(sprint).toMatchObject({
        id: expect.any(String),
        teamId: team.id,
        name: "Sprint 1",
        startDate: "2026-10-29",
        endDate: "2026-11-04",
        standupsPerPerson: 3,
        reviewsPerPerson: 5,
      });
      const stored = await db.sprint.findUniqueOrThrow({
        where: { id: sprint.id },
      });
      expect(stored.name).toBe("Sprint 1");
    });
  });

  describe("listSprints", () => {
    it("returns sprints for the team ordered by start date ascending", async () => {
      // Arrange
      const team = await insertTeam();
      const otherTeam = await insertTeam();
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
      await insertSprint({
        teamId: otherTeam.id,
        name: "Other Sprint",
        startDate: "2026-10-20",
        endDate: "2026-10-28",
      });

      // Act
      const sprints = await listSprints({ teamId: team.id });

      // Assert
      expect(sprints).toHaveLength(2);
      expect(sprints[0].name).toBe("Sprint 1");
      expect(sprints[0].startDate).toBe("2026-10-29");
      expect(sprints[1].name).toBe("Sprint 2");
      expect(sprints[1].startDate).toBe("2026-11-05");
    });
  });

  describe("findSprintById", () => {
    it("returns the sprint when it exists and belongs to the team", async () => {
      // Arrange
      const team = await insertTeam();
      const created = await insertSprint({
        teamId: team.id,
        name: "Sprint 1",
        startDate: "2026-10-29",
        endDate: "2026-11-04",
      });

      // Act
      const found = await findSprintById({
        teamId: team.id,
        sprintId: created.id,
      });

      // Assert
      expect(found).not.toBeNull();
      expect(found?.id).toBe(created.id);
      expect(found?.startDate).toBe("2026-10-29");
      expect(found?.endDate).toBe("2026-11-04");
    });

    it("returns null when the sprint belongs to a different team", async () => {
      // Arrange
      const team = await insertTeam();
      const otherTeam = await insertTeam();
      const created = await insertSprint({ teamId: otherTeam.id });

      // Act
      const found = await findSprintById({
        teamId: team.id,
        sprintId: created.id,
      });

      // Assert
      expect(found).toBeNull();
    });
  });

  describe("updateSprint", () => {
    it("updates sprint properties and returns updated values with YYYY-MM-DD dates", async () => {
      // Arrange
      const team = await insertTeam();
      const created = await insertSprint({
        teamId: team.id,
        name: "Old Name",
        startDate: "2026-10-29",
        endDate: "2026-11-04",
      });

      // Act
      const updated = await updateSprint({
        teamId: team.id,
        sprintId: created.id,
        name: "New Name",
        startDate: "2026-10-30",
        endDate: "2026-11-05",
        standupsPerPerson: 4,
        reviewsPerPerson: 6,
      });

      // Assert
      expect(updated).toMatchObject({
        id: created.id,
        name: "New Name",
        startDate: "2026-10-30",
        endDate: "2026-11-05",
        standupsPerPerson: 4,
        reviewsPerPerson: 6,
      });
      const stored = await db.sprint.findUniqueOrThrow({
        where: { id: created.id },
      });
      expect(stored.name).toBe("New Name");
      expect(stored.standupsPerPerson).toBe(4);
    });
  });
});
