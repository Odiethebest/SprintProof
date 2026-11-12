import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import {
  listTeamActivities,
  recordWebhookEvent,
} from "@/server/repositories/activities";
import { insertActivity, insertTeam } from "../../factories/db";
import { clearDatabase } from "../setup/test-setup";

describe("activities repository", () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  describe("recordWebhookEvent", () => {
    it("stores a review's state, and no state for other activity", async () => {
      // Arrange
      const team = await insertTeam();
      const occurredAt = new Date("2026-11-02T18:00:00.000Z");

      // Act
      await recordWebhookEvent({
        teamId: team.id,
        event: "pull_request_review",
        deliveryId: "review-state-delivery",
        activities: [
          {
            type: "REVIEW",
            actorLogin: "bob",
            prNumber: 12,
            prAuthorLogin: "alice",
            sha: null,
            title: "Show live contribution dashboard",
            reviewState: "COMMENTED",
            occurredAt,
          },
          {
            type: "COMMIT",
            actorLogin: "alice",
            prNumber: null,
            prAuthorLogin: null,
            sha: "sha-1",
            title: "Add the dashboard page",
            reviewState: null,
            occurredAt,
          },
        ],
      });

      // Assert
      const stored = await db.activity.findMany({
        where: { teamId: team.id },
        orderBy: { type: "asc" },
        select: { type: true, reviewState: true },
      });
      expect(stored).toEqual([
        { type: "COMMIT", reviewState: null },
        { type: "REVIEW", reviewState: "COMMENTED" },
      ]);
    });
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
        reviewState: "CHANGES_REQUESTED",
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
          reviewState: "CHANGES_REQUESTED",
          occurredAt: new Date("2026-11-02T18:00:00.000Z"),
        },
      ]);
    });

    it("returns no review state for a review stored before states were recorded, or for other activity", async () => {
      // Arrange: rows written without a review state, as before #57
      const team = await insertTeam();
      await insertActivity({
        teamId: team.id,
        type: "REVIEW",
        actorLogin: "bob",
        prNumber: 12,
        prAuthorLogin: "alice",
        occurredAt: new Date("2026-11-02T18:00:00.000Z"),
      });
      await insertActivity({
        teamId: team.id,
        type: "COMMIT",
        actorLogin: "alice",
        sha: "sha-1",
        occurredAt: new Date("2026-11-02T17:00:00.000Z"),
      });

      // Act
      const activities = await listTeamActivities({
        teamId: team.id,
        from: new Date("2026-10-29T07:00:00.000Z"),
        to: new Date("2026-11-05T07:59:59.999Z"),
      });

      // Assert
      expect(
        activities.map(({ type, reviewState }) => ({ type, reviewState }))
      ).toEqual([
        { type: "REVIEW", reviewState: null },
        { type: "COMMIT", reviewState: null },
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
