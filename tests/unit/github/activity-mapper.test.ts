import { describe, expect, it } from "vitest";
import pingPayload from "../../fixtures/github/ping.json";
import pushPayload from "../../fixtures/github/push.json";
import prOpenedPayload from "../../fixtures/github/pull-request-opened.json";
import prMergedPayload from "../../fixtures/github/pull-request-closed-merged.json";
import prUnmergedPayload from "../../fixtures/github/pull-request-closed-unmerged.json";
import prReviewPayload from "../../fixtures/github/pull-request-review.json";
import prReviewBotPayload from "../../fixtures/github/pull-request-review-bot.json";
import {
  extractWebhookRepository,
  mapWebhookToActivities,
} from "@/lib/github/webhook-events";

describe("extractWebhookRepository", () => {
  it("extracts the numeric id and full_name from a webhook payload", () => {
    const repo = extractWebhookRepository({ payload: pushPayload });
    expect(repo).toEqual({
      id: 987654321,
      fullName: "Odiethebest/SprintProof",
    });
  });

  it("extracts repository from a ping payload", () => {
    const repo = extractWebhookRepository({ payload: pingPayload });
    expect(repo).toEqual({
      id: 987654321,
      fullName: "Odiethebest/SprintProof",
    });
  });

  it("returns null when payload has no repository or is invalid", () => {
    expect(extractWebhookRepository({ payload: {} })).toBeNull();
    expect(extractWebhookRepository({ payload: null })).toBeNull();
    expect(
      extractWebhookRepository({
        payload: { repository: { id: "not-a-number", full_name: "owner/repo" } },
      })
    ).toBeNull();
    expect(
      extractWebhookRepository({
        payload: { repository: { id: 123, full_name: "" } },
      })
    ).toBeNull();
  });
});

describe("mapWebhookToActivities", () => {
  describe("push", () => {
    it("maps commits to COMMIT activities using commit timestamp as occurredAt", () => {
      const activities = mapWebhookToActivities({
        event: "push",
        payload: pushPayload,
      });

      // push.json has 3 commits: 1 user, 1 bot, 1 outsider. The bot is ignored.
      expect(activities).toHaveLength(2);

      expect(activities[0]).toEqual({
        type: "COMMIT",
        actorLogin: "alice",
        prNumber: null,
        prAuthorLogin: null,
        sha: "1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b",
        title: "feat: add feature",
        occurredAt: new Date("2026-11-05T15:30:00Z"),
      });

      expect(activities[1]).toEqual({
        type: "COMMIT",
        actorLogin: "outsider",
        prNumber: null,
        prAuthorLogin: null,
        sha: "3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d",
        title: "fix: bugfix by outsider",
        occurredAt: new Date("2026-11-05T15:32:00Z"),
      });
    });

    it("ignores commits from bot logins ending in [bot]", () => {
      const activities = mapWebhookToActivities({
        event: "push",
        payload: pushPayload,
      });
      const botActivities = activities.filter((a) =>
        a.actorLogin.toLowerCase().endsWith("[bot]")
      );
      expect(botActivities).toHaveLength(0);
    });

    it("falls back to committer or sender when author username is missing", () => {
      const payload = {
        repository: { id: 123, full_name: "o/r" },
        sender: { login: "sender_user" },
        commits: [
          {
            id: "commit-no-author-username",
            message: "commit without author username",
            timestamp: "2026-11-05T12:00:00Z",
            author: { name: "No Username", email: "none@example.com" },
            committer: {
              name: "Committer User",
              email: "c@example.com",
              username: "committer_user",
            },
          },
          {
            id: "commit-fallback-sender",
            message: "commit falling back to sender",
            timestamp: "2026-11-05T12:01:00Z",
            author: { name: "No Username", email: "none@example.com" },
            committer: { name: "No Username", email: "none@example.com" },
          },
        ],
      };

      const activities = mapWebhookToActivities({
        event: "push",
        payload,
      });

      expect(activities).toHaveLength(2);
      expect(activities[0].actorLogin).toBe("committer_user");
      expect(activities[1].actorLogin).toBe("sender_user");
    });

    it("returns empty array when commits array is missing or empty", () => {
      expect(
        mapWebhookToActivities({
          event: "push",
          payload: { repository: { id: 123, full_name: "o/r" }, commits: [] },
        })
      ).toEqual([]);
    });
  });

  describe("pull_request", () => {
    it("maps pull_request opened to PR_OPENED activity", () => {
      const activities = mapWebhookToActivities({
        event: "pull_request",
        payload: prOpenedPayload,
      });

      expect(activities).toHaveLength(1);
      expect(activities[0]).toEqual({
        type: "PR_OPENED",
        actorLogin: "alice",
        prNumber: 42,
        prAuthorLogin: "alice",
        sha: null,
        title: "Add webhook receiver",
        occurredAt: new Date("2026-11-05T16:00:00Z"),
      });
    });

    it("maps pull_request closed with merged: true to PR_MERGED activity", () => {
      const activities = mapWebhookToActivities({
        event: "pull_request",
        payload: prMergedPayload,
      });

      expect(activities).toHaveLength(1);
      expect(activities[0]).toEqual({
        type: "PR_MERGED",
        actorLogin: "bob",
        prNumber: 42,
        prAuthorLogin: "alice",
        sha: null,
        title: "Add webhook receiver",
        occurredAt: new Date("2026-11-05T17:00:00Z"),
      });
    });

    it("ignores pull_request closed when merged is false", () => {
      const activities = mapWebhookToActivities({
        event: "pull_request",
        payload: prUnmergedPayload,
      });
      expect(activities).toEqual([]);
    });

    it("ignores other pull_request actions such as edited or reopened", () => {
      expect(
        mapWebhookToActivities({
          event: "pull_request",
          payload: { ...prOpenedPayload, action: "edited" },
        })
      ).toEqual([]);
      expect(
        mapWebhookToActivities({
          event: "pull_request",
          payload: { ...prOpenedPayload, action: "reopened" },
        })
      ).toEqual([]);
      expect(
        mapWebhookToActivities({
          event: "pull_request",
          payload: { ...prOpenedPayload, action: "labeled" },
        })
      ).toEqual([]);
    });

    it("ignores pull_request opened by a bot ending in [bot]", () => {
      const payload = {
        ...prOpenedPayload,
        pull_request: {
          ...prOpenedPayload.pull_request,
          user: { login: "renovate[bot]" },
        },
      };
      const activities = mapWebhookToActivities({
        event: "pull_request",
        payload,
      });
      expect(activities).toEqual([]);
    });
  });

  describe("pull_request_review", () => {
    it("maps pull_request_review submitted to REVIEW activity", () => {
      const activities = mapWebhookToActivities({
        event: "pull_request_review",
        payload: prReviewPayload,
      });

      expect(activities).toHaveLength(1);
      expect(activities[0]).toEqual({
        type: "REVIEW",
        actorLogin: "bob",
        prNumber: 42,
        prAuthorLogin: "alice",
        sha: null,
        title: "Add webhook receiver",
        occurredAt: new Date("2026-11-05T16:45:00Z"),
      });
    });

    it("ignores reviews submitted by a bot ending in [bot]", () => {
      const activities = mapWebhookToActivities({
        event: "pull_request_review",
        payload: prReviewBotPayload,
      });
      expect(activities).toEqual([]);
    });

    it("ignores other pull_request_review actions such as dismissed", () => {
      expect(
        mapWebhookToActivities({
          event: "pull_request_review",
          payload: { ...prReviewPayload, action: "dismissed" },
        })
      ).toEqual([]);
    });
  });

  describe("ping and other events", () => {
    it("returns empty array for ping event", () => {
      expect(
        mapWebhookToActivities({
          event: "ping",
          payload: pingPayload,
        })
      ).toEqual([]);
    });

    it("returns empty array for unhandled event types", () => {
      expect(
        mapWebhookToActivities({
          event: "issues",
          payload: { action: "opened" },
        })
      ).toEqual([]);
    });

    it("returns empty array when payload is not an object", () => {
      expect(
        mapWebhookToActivities({
          event: "push",
          payload: "not-an-object",
        })
      ).toEqual([]);
      expect(
        mapWebhookToActivities({
          event: "push",
          payload: null,
        })
      ).toEqual([]);
    });
  });
});
