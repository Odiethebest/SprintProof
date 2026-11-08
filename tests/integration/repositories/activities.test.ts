import { beforeEach, describe, expect, it } from "vitest";
import { listTeamActivities } from "@/server/repositories/activities";
import { insertActivity, insertTeam } from "../../factories/db";
import { clearDatabase } from "../setup/test-setup";

describe("activities repository", () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  describe("listTeamActivities", () => {
    it("returns the team's activities between from and to, inclusive, newest first", async () => {
      // Arrange
      const team = await insertTeam();
      const before = await insertActivity({
        teamId: team.id,
        type: "COMMIT",
        actorLogin: "alice",
        sha: "sha-before",
        occurredAt: new Date("2026-10-29T06:59:59.999Z"),
      });
      const atStart = await insertActivity({
        teamId: team.id,
        type: "COMMIT",
        actorLogin: "alice",
        sha: "sha-start",
        occurredAt: new Date("2026-10-29T07:00:00.000Z"),
      });
      const middle = await insertActivity({
        teamId: team.id,
        type: "PR_OPENED",
        actorLogin: "alice",
        prNumber: 12,
        prAuthorLogin: "alice",
        title: "Show live contribution dashboard",
        occurredAt: new Date("2026-11-02T18:00:00.000Z"),
      });
      const atEnd = await insertActivity({
        teamId: team.id,
        type: "REVIEW",
        actorLogin: "bob",
        prNumber: 12,
        prAuthorLogin: "alice",
        title: "Show live contribution dashboard",
        occurredAt: new Date("2026-11-05T07:59:59.999Z"),
      });
      const after = await insertActivity({
        teamId: team.id,
        type: "COMMIT",
        actorLogin: "alice",
        sha: "sha-after",
        occurredAt: new Date("2026-11-05T08:00:00.000Z"),
      });

      // Act
      const activities = await listTeamActivities({
        teamId: team.id,
        from: new Date("2026-10-29T07:00:00.000Z"),
        to: new Date("2026-11-05T07:59:59.999Z"),
      });

      // Assert
      expect(activities.map((activity) => activity.id)).toEqual([
        atEnd.id,
        middle.id,
        atStart.id,
      ]);
      expect(activities.map((activity) => activity.id)).not.toContain(
        before.id
      );
      expect(activities.map((activity) => activity.id)).not.toContain(after.id);
    });

    it("returns the fields the dashboard needs and nothing else", async () => {
      // Arrange
      const team = await insertTeam();
      const stored = await insertActivity({
        teamId: team.id,
        type: "REVIEW",
        actorLogin: "bob",
        prNumber: 12,
        prAuthorLogin: "alice",
        sha: null,
        title: "Show live contribution dashboard",
        occurredAt: new Date("2026-11-02T18:00:00.000Z"),
      });

      // Act
      const activities = await listTeamActivities({
        teamId: team.id,
        from: new Date("2026-10-29T07:00:00.000Z"),
        to: new Date("2026-11-05T07:59:59.999Z"),
      });

      // Assert
      expect(activities).toEqual([
        {
          id: stored.id,
          type: "REVIEW",
          actorLogin: "bob",
          prNumber: 12,
          prAuthorLogin: "alice",
          sha: null,
          title: "Show live contribution dashboard",
          occurredAt: new Date("2026-11-02T18:00:00.000Z"),
        },
      ]);
    });

    it("leaves out other teams' activities", async () => {
      // Arrange
      const team = await insertTeam();
      const otherTeam = await insertTeam();
      await insertActivity({
        teamId: otherTeam.id,
        type: "COMMIT",
        actorLogin: "alice",
        sha: "sha-other",
        occurredAt: new Date("2026-11-02T18:00:00.000Z"),
      });

      // Act
      const activities = await listTeamActivities({
        teamId: team.id,
        from: new Date("2026-10-29T07:00:00.000Z"),
        to: new Date("2026-11-05T07:59:59.999Z"),
      });

      // Assert
      expect(activities).toEqual([]);
    });
  });
});
