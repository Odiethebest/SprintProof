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

function activitiesFor(input: { event: string; payload: unknown }) {
  const result = mapWebhookToActivities(input);
  if (!result.isValid) {
    throw new Error(`Expected a valid payload, got: ${result.message}`);
  }
  return result.activities;
}

function rejectionFor(input: { event: string; payload: unknown }) {
  const result = mapWebhookToActivities(input);
  if (result.isValid) {
    throw new Error("Expected the payload to be rejected");
  }
  return result.message;
}

const pushCommit = pushPayload.commits[0];

function pushWith(commit: Record<string, unknown>) {
  return { ...pushPayload, commits: [commit] };
}

function withoutKey<T extends object>(value: T, key: keyof T) {
  const copy: Partial<T> = { ...value };
  delete copy[key];
  return copy;
}

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
      const activities = activitiesFor({
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
        reviewState: null,
        occurredAt: new Date("2026-11-05T15:30:00Z"),
      });

      expect(activities[1]).toEqual({
        type: "COMMIT",
        actorLogin: "outsider",
        prNumber: null,
        prAuthorLogin: null,
        sha: "3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d",
        title: "fix: bugfix by outsider",
        reviewState: null,
        occurredAt: new Date("2026-11-05T15:32:00Z"),
      });
    });

    it("ignores commits from bot logins ending in [bot]", () => {
      const activities = activitiesFor({
        event: "push",
        payload: pushPayload,
      });
      const botActivities = activities.filter((a) =>
        a.actorLogin.toLowerCase().endsWith("[bot]")
      );
      expect(botActivities).toHaveLength(0);
    });

    // Counting rule: commits are attributed by the author's GitHub login (AGENTS.md §1).
    // Whoever pushed or committed (a local merge, a rebase) didn't write them.
    it("skips a commit whose author has no GitHub username, even when the committer or the pusher has one", () => {
      // Arrange
      const payload = {
        repository: { id: 123, full_name: "o/r" },
        sender: { login: "sender_user" },
        commits: [
          {
            id: "commit-no-author-username",
            message: "author email not linked to GitHub",
            timestamp: "2026-11-05T12:00:00Z",
            author: { name: "No Username", email: "none@example.com" },
            committer: {
              name: "Committer User",
              email: "c@example.com",
              username: "committer_user",
            },
          },
          {
            id: "commit-by-alice",
            message: "commit with a linked author",
            timestamp: "2026-11-05T12:01:00Z",
            author: { name: "Alice", email: "a@example.com", username: "alice" },
            committer: { name: "No Username", email: "none@example.com" },
          },
        ],
      };

      // Act
      const activities = activitiesFor({ event: "push", payload });

      // Assert
      expect(activities.map((a) => [a.sha, a.actorLogin])).toEqual([
        ["commit-by-alice", "alice"],
      ]);
    });

    it("reads a commit timestamp with a UTC offset", () => {
      const [activity] = activitiesFor({
        event: "push",
        payload: pushWith({ ...pushCommit, timestamp: "2026-11-05T07:30:00-08:00" }),
      });
      expect(activity.occurredAt).toEqual(new Date("2026-11-05T15:30:00Z"));
    });

    it("returns no activities for a push with no commits", () => {
      expect(
        activitiesFor({
          event: "push",
          payload: { repository: { id: 123, full_name: "o/r" }, commits: [] },
        })
      ).toEqual([]);
    });

    it.each([
      ["has no commits list", withoutKey(pushPayload, "commits")],
      ["has a commit without an id", pushWith(withoutKey(pushCommit, "id"))],
      ["has a commit without a timestamp", pushWith(withoutKey(pushCommit, "timestamp"))],
      ["has a commit whose timestamp isn't a date", pushWith({ ...pushCommit, timestamp: "yesterday" })],
      ["has a commit without an author", pushWith(withoutKey(pushCommit, "author"))],
      ["isn't an object", "not-an-object"],
      ["is null", null],
    ])("rejects a push that %s", (_label, payload) => {
      expect(rejectionFor({ event: "push", payload })).toBe(
        "This push payload isn't in the format GitHub sends."
      );
    });
  });

  describe("pull_request", () => {
    it("maps pull_request opened to PR_OPENED activity", () => {
      const activities = activitiesFor({
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
        reviewState: null,
        occurredAt: new Date("2026-11-05T16:00:00Z"),
      });
    });

    it("maps pull_request closed with merged: true to PR_MERGED activity", () => {
      const activities = activitiesFor({
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
        reviewState: null,
        occurredAt: new Date("2026-11-05T17:00:00Z"),
      });
    });

    it("ignores pull_request closed when merged is false", () => {
      const activities = activitiesFor({
        event: "pull_request",
        payload: prUnmergedPayload,
      });
      expect(activities).toEqual([]);
    });

    it("ignores other pull_request actions such as edited or reopened", () => {
      expect(
        activitiesFor({
          event: "pull_request",
          payload: { ...prOpenedPayload, action: "edited" },
        })
      ).toEqual([]);
      expect(
        activitiesFor({
          event: "pull_request",
          payload: { ...prOpenedPayload, action: "reopened" },
        })
      ).toEqual([]);
      expect(
        activitiesFor({
          event: "pull_request",
          payload: { ...prOpenedPayload, action: "labeled" },
        })
      ).toEqual([]);
    });

    it("doesn't check the rest of the payload for actions it doesn't record", () => {
      expect(
        activitiesFor({ event: "pull_request", payload: { action: "labeled" } })
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
      const activities = activitiesFor({
        event: "pull_request",
        payload,
      });
      expect(activities).toEqual([]);
    });

    it.each([
      ["has no action", withoutKey(prOpenedPayload, "action")],
      [
        "was opened without created_at",
        {
          ...prOpenedPayload,
          pull_request: withoutKey(prOpenedPayload.pull_request, "created_at"),
        },
      ],
      [
        "was opened without an author",
        {
          ...prOpenedPayload,
          pull_request: withoutKey(prOpenedPayload.pull_request, "user"),
        },
      ],
      // No fallback to the sender: whoever sent the event may not be who merged.
      [
        "was merged without merged_by",
        {
          ...prMergedPayload,
          pull_request: { ...prMergedPayload.pull_request, merged_by: null },
        },
      ],
      [
        "was merged without merged_at",
        {
          ...prMergedPayload,
          pull_request: { ...prMergedPayload.pull_request, merged_at: null },
        },
      ],
    ])("rejects a pull request that %s", (_label, payload) => {
      expect(rejectionFor({ event: "pull_request", payload })).toBe(
        "This pull_request payload isn't in the format GitHub sends."
      );
    });
  });

  describe("pull_request_review", () => {
    it("maps pull_request_review submitted to REVIEW activity", () => {
      const activities = activitiesFor({
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
        reviewState: "APPROVED",
        occurredAt: new Date("2026-11-05T16:45:00Z"),
      });
    });

    // GitHub sends review.state in lowercase in pull_request_review payloads.
    it.each([
      ["approved", "APPROVED"],
      ["changes_requested", "CHANGES_REQUESTED"],
      ["commented", "COMMENTED"],
    ])(
      "stores a review submitted as %s with the state %s",
      (state, reviewState) => {
        // Arrange
        const payload = {
          ...prReviewPayload,
          review: { ...prReviewPayload.review, state },
        };

        // Act
        const [activity] = activitiesFor({
          event: "pull_request_review",
          payload,
        });

        // Assert
        expect(activity).toMatchObject({ type: "REVIEW", reviewState });
      }
    );

    // A submitted review counts under R3 whatever GitHub calls it, and a
    // redelivery carries the same state, so rejecting the payload would drop
    // the review for good. It's stored with no state: the feed says "reviewed #N".
    it.each([
      ["an unknown state", { ...prReviewPayload.review, state: "dismissed" }],
      ["a state in capitals", { ...prReviewPayload.review, state: "APPROVED" }],
      ["a state that isn't text", { ...prReviewPayload.review, state: 42 }],
      ["no state", withoutKey(prReviewPayload.review, "state")],
    ])(
      "stores a review submitted with %s as a review with no state",
      (_label, review) => {
        // Act
        const activities = activitiesFor({
          event: "pull_request_review",
          payload: { ...prReviewPayload, review },
        });

        // Assert
        expect(activities).toEqual([
          {
            type: "REVIEW",
            actorLogin: "bob",
            prNumber: 42,
            prAuthorLogin: "alice",
            sha: null,
            title: "Add webhook receiver",
            reviewState: null,
            occurredAt: new Date("2026-11-05T16:45:00Z"),
          },
        ]);
      }
    );

    it("ignores reviews submitted by a bot ending in [bot]", () => {
      const activities = activitiesFor({
        event: "pull_request_review",
        payload: prReviewBotPayload,
      });
      expect(activities).toEqual([]);
    });

    it("ignores other pull_request_review actions such as dismissed", () => {
      expect(
        activitiesFor({
          event: "pull_request_review",
          payload: { ...prReviewPayload, action: "dismissed" },
        })
      ).toEqual([]);
    });

    it.each([
      [
        "has no submitted_at",
        { ...prReviewPayload, review: withoutKey(prReviewPayload.review, "submitted_at") },
      ],
      [
        "has no reviewer",
        { ...prReviewPayload, review: withoutKey(prReviewPayload.review, "user") },
      ],
      [
        "has no pull request number",
        {
          ...prReviewPayload,
          pull_request: withoutKey(prReviewPayload.pull_request, "number"),
        },
      ],
    ])("rejects a submitted review that %s", (_label, payload) => {
      expect(rejectionFor({ event: "pull_request_review", payload })).toBe(
        "This pull_request_review payload isn't in the format GitHub sends."
      );
    });
  });

  // PostgreSQL text can't store NUL, and a redelivery carries the same text, so
  // rejecting it would drop the event for good. The mapper removes it (#90).
  describe("NUL characters in webhook text", () => {
    it("removes NUL characters from a commit message and maps the commit as usual", () => {
      const [activity] = activitiesFor({
        event: "push",
        payload: pushWith({
          ...pushCommit,
          message:
            "feat: add\u0000 feature\u0000\n\nDetailed\u0000 explanation",
        }),
      });

      expect(activity).toEqual({
        type: "COMMIT",
        actorLogin: "alice",
        prNumber: null,
        prAuthorLogin: null,
        sha: "1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b",
        title: "feat: add feature",
        reviewState: null,
        occurredAt: new Date("2026-11-05T15:30:00Z"),
      });
    });

    it("stores no title for a commit whose first line is only NUL characters", () => {
      const [activity] = activitiesFor({
        event: "push",
        payload: pushWith({ ...pushCommit, message: "\u0000\u0000\nDetails" }),
      });

      expect(activity.title).toBeNull();
    });

    it.each([
      ["an opened pull request", "pull_request", prOpenedPayload],
      ["a merged pull request", "pull_request", prMergedPayload],
      ["a submitted review", "pull_request_review", prReviewPayload],
    ])(
      "removes NUL characters from the PR title of %s",
      (_label, event, payload) => {
        const [activity] = activitiesFor({
          event,
          payload: {
            ...payload,
            pull_request: {
              ...payload.pull_request,
              title: "Add\u0000 webhook receiver\u0000",
            },
          },
        });

        expect(activity.title).toBe("Add webhook receiver");
      }
    );
  });

  describe("ping and other events", () => {
    it("returns empty array for ping event", () => {
      expect(
        activitiesFor({
          event: "ping",
          payload: pingPayload,
        })
      ).toEqual([]);
    });

    it("returns empty array for unhandled event types", () => {
      expect(
        activitiesFor({
          event: "issues",
          payload: { action: "opened" },
        })
      ).toEqual([]);
    });

    it("doesn't check the payload of an event it doesn't record", () => {
      expect(activitiesFor({ event: "issues", payload: null })).toEqual([]);
    });
  });
});
