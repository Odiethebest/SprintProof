import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import {
  listTeamActivities,
  recordWebhookEvent,
} from "@/server/repositories/activities";
import {
  mapWebhookToActivities,
  type MappedActivity,
} from "@/lib/github/webhook-events";
import { countMemberActivity } from "@/lib/stats/member-activity";
import { insertActivity, insertTeam } from "../../factories/db";
import {
  createPushCommit,
  createPushPayload,
  createRebasedCopy,
} from "../../factories/github-push";
import { clearDatabase } from "../setup/test-setup";

// The activities the webhook route would store for a push of these commits.
function mappedPush(commits: object[]): MappedActivity[] {
  const mapping = mapWebhookToActivities({
    event: "push",
    payload: createPushPayload({
      ref: "refs/heads/feature/12-dashboard",
      commits,
    }),
  });
  if (!mapping.isValid) {
    throw new Error(mapping.message);
  }
  return mapping.activities;
}

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
            commitKey: null,
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
            commitKey: null,
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

    // Counting rule (#114, decision 004): a commit counts once per author,
    // author date and full message, whatever its SHA.
    it("stores a commit and its copy under a new SHA once, though one delivery carries both", async () => {
      // Arrange: a branch that still has a commit and its cherry-picked copy
      const team = await insertTeam();
      const original = createPushCommit();
      const copy = createRebasedCopy(original, {
        id: "0f9e8d7c6b5a4938271605f4e3d2c1b0a9876543",
        committedAt: "2026-11-03T09:15:00Z",
      });

      // Act
      const result = await recordWebhookEvent({
        teamId: team.id,
        event: "push",
        deliveryId: "commit-and-copy",
        activities: mappedPush([original, copy]),
      });

      // Assert
      expect(result).toEqual({ alreadyProcessed: false, activitiesCreated: 1 });
      expect(
        await db.activity.findMany({
          where: { teamId: team.id },
          select: { sha: true },
        })
      ).toEqual([{ sha: original.id }]);
    });

    it("stores commits without a commit key by SHA only, as before", async () => {
      // Arrange: rows written without a key, as the payload left out the author date
      const team = await insertTeam();
      const activities = mappedPush([
        createPushCommit({ id: "sha-1", message: "Same message" }),
        createPushCommit({ id: "sha-2", message: "Same message" }),
      ]).map((activity) => ({ ...activity, commitKey: null }));

      // Act
      await recordWebhookEvent({
        teamId: team.id,
        event: "push",
        deliveryId: "keyless-1",
        activities,
      });
      await recordWebhookEvent({
        teamId: team.id,
        event: "push",
        deliveryId: "keyless-2",
        activities,
      });

      // Assert
      const stored = await db.activity.findMany({
        where: { teamId: team.id },
        orderBy: { sha: "asc" },
        select: { sha: true, commitKey: true },
      });
      expect(stored).toEqual([
        { sha: "sha-1", commitKey: null },
        { sha: "sha-2", commitKey: null },
      ]);
    });

    it("stores the same commit once for each team that receives it", async () => {
      // Arrange
      const team = await insertTeam();
      const otherTeam = await insertTeam();
      const commit = createPushCommit();

      // Act
      for (const [teamId, deliveryId] of [
        [team.id, "team-delivery"],
        [otherTeam.id, "other-team-delivery"],
      ]) {
        await recordWebhookEvent({
          teamId,
          event: "push",
          deliveryId,
          activities: mappedPush([commit]),
        });
      }

      // Assert
      expect(await db.activity.count({ where: { sha: commit.id } })).toBe(2);
    });

    // The counts read stored rows, so they follow storage: one per commit.
    it("counts a commit and its rebased copy as one commit in the sprint", async () => {
      // Arrange
      const team = await insertTeam();
      const original = createPushCommit();
      const copy = createRebasedCopy(original, {
        id: "0f9e8d7c6b5a4938271605f4e3d2c1b0a9876543",
        committedAt: "2026-11-03T09:15:00Z",
      });
      await recordWebhookEvent({
        teamId: team.id,
        event: "push",
        deliveryId: "original",
        activities: mappedPush([original]),
      });
      await recordWebhookEvent({
        teamId: team.id,
        event: "push",
        deliveryId: "copy",
        activities: mappedPush([copy]),
      });

      // Act
      const counts = countMemberActivity({
        sprint: { startDate: "2026-10-29", endDate: "2026-11-04" },
        timeZone: "America/Los_Angeles",
        members: [{ userId: "alice-id", githubLogin: "alice" }],
        activities: await listTeamActivities({
          teamId: team.id,
          from: new Date("2026-10-29T07:00:00.000Z"),
          to: new Date("2026-11-05T07:59:59.999Z"),
        }),
      });

      // Assert
      expect(counts).toEqual([
        { userId: "alice-id", commits: 1, pullRequests: 0 },
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
