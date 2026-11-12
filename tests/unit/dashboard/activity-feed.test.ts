import { beforeEach, describe, expect, it } from "vitest";
import {
  ACTIVITY_FEED_LIMIT,
  buildActivityFeed,
} from "@/lib/dashboard/activity-feed";
import {
  createActivityRecord,
  createMember,
  createStandupEntry,
  resetActivitySeq,
  resetMemberSeq,
  resetStandupSeq,
} from "../../factories";

const timeZone = "America/Los_Angeles";
const sprint = { startDate: "2026-10-29", endDate: "2026-11-04" };

describe("buildActivityFeed", () => {
  const alice = () => createMember({ userId: "user-1", githubLogin: "alice" });
  const bob = () => createMember({ userId: "user-2", githubLogin: "bob" });

  beforeEach(() => {
    resetMemberSeq();
    resetActivitySeq();
    resetStandupSeq();
  });

  it("returns an empty list for an empty sprint", () => {
    // Act
    const feed = buildActivityFeed({
      sprint,
      timeZone,
      members: [alice()],
      standups: [],
      activities: [],
    });

    // Assert
    expect(feed).toEqual([]);
  });

  it("lists a standup with its Today text at the time it was posted", () => {
    // Arrange
    const standup = createStandupEntry({
      id: "standup-9",
      userId: "user-1",
      today: "Team creation and invite links (#7).",
      createdAt: new Date("2026-11-02T17:05:00Z"),
      updatedAt: new Date("2026-11-02T18:30:00Z"),
    });

    // Act
    const feed = buildActivityFeed({
      sprint,
      timeZone,
      members: [alice()],
      standups: [standup],
      activities: [],
    });

    // Assert
    expect(feed).toEqual([
      {
        kind: "STANDUP",
        id: "standup-9",
        userId: "user-1",
        summary: "Team creation and invite links (#7).",
        occurredAt: new Date("2026-11-02T17:05:00Z"),
      },
    ]);
  });

  it("lists an opened PR with its number and title", () => {
    const opened = createActivityRecord({
      id: "activity-pr",
      type: "PR_OPENED",
      actorLogin: "alice",
      prNumber: 113,
      prAuthorLogin: "alice",
      sha: null,
      title: "Async standup check-in and history",
      occurredAt: new Date("2026-11-03T18:15:00Z"),
    });

    const feed = buildActivityFeed({
      sprint,
      timeZone,
      members: [alice()],
      standups: [],
      activities: [opened],
    });

    expect(feed).toEqual([
      {
        kind: "PR_OPENED",
        id: "activity-pr",
        userId: "user-1",
        prNumber: 113,
        summary: "Async standup check-in and history",
        occurredAt: new Date("2026-11-03T18:15:00Z"),
      },
    ]);
  });

  it("lists a review with the PR's number, title and review state", () => {
    const review = createActivityRecord({
      id: "activity-review",
      type: "REVIEW",
      actorLogin: "bob",
      prNumber: 113,
      prAuthorLogin: "alice",
      sha: null,
      title: "Async standup check-in and history",
      reviewState: "APPROVED",
      occurredAt: new Date("2026-11-03T22:41:00Z"),
    });

    const feed = buildActivityFeed({
      sprint,
      timeZone,
      members: [alice(), bob()],
      standups: [],
      activities: [review],
    });

    expect(feed).toEqual([
      {
        kind: "REVIEW",
        id: "activity-review",
        userId: "user-2",
        prNumber: 113,
        reviewState: "APPROVED",
        summary: "Async standup check-in and history",
        occurredAt: new Date("2026-11-03T22:41:00Z"),
      },
    ]);
  });

  // Reviews stored before #57 have no state (null).
  it.each(["APPROVED", "CHANGES_REQUESTED", "COMMENTED", null] as const)(
    "keeps the review state %s on the review's item",
    (reviewState) => {
      const review = createActivityRecord({
        type: "REVIEW",
        actorLogin: "bob",
        prNumber: 113,
        prAuthorLogin: "alice",
        sha: null,
        reviewState,
      });

      const feed = buildActivityFeed({
        sprint,
        timeZone,
        members: [alice(), bob()],
        standups: [],
        activities: [review],
      });

      expect(feed).toHaveLength(1);
      expect(feed[0]).toMatchObject({ kind: "REVIEW", reviewState });
    }
  );

  it("leaves out reviews on the reviewer's own PR, which never count", () => {
    // Counting rule: reviews on your own PR never count (AGENTS.md §1)
    const ownReview = createActivityRecord({
      type: "REVIEW",
      actorLogin: "alice",
      prNumber: 113,
      prAuthorLogin: "Alice",
      sha: null,
    });

    const feed = buildActivityFeed({
      sprint,
      timeZone,
      members: [alice()],
      standups: [],
      activities: [ownReview],
    });

    expect(feed).toEqual([]);
  });

  it("leaves out merged PRs", () => {
    const merged = createActivityRecord({
      type: "PR_MERGED",
      actorLogin: "alice",
      prNumber: 113,
      prAuthorLogin: "alice",
      sha: null,
    });

    const feed = buildActivityFeed({
      sprint,
      timeZone,
      members: [alice()],
      standups: [],
      activities: [merged],
    });

    expect(feed).toEqual([]);
  });

  it("groups a member's commits on one day into an item with the count and the latest message", () => {
    // Arrange: three commits on Nov 2 in Los Angeles
    const commits = [
      createActivityRecord({
        actorLogin: "alice",
        title: "Sprint overlap validation",
        occurredAt: new Date("2026-11-02T17:00:00Z"),
      }),
      createActivityRecord({
        actorLogin: "alice",
        title: "Group standups by day",
        occurredAt: new Date("2026-11-02T21:41:00Z"),
      }),
      createActivityRecord({
        actorLogin: "alice",
        title: "Standup form validation",
        occurredAt: new Date("2026-11-02T19:00:00Z"),
      }),
    ];

    // Act
    const feed = buildActivityFeed({
      sprint,
      timeZone,
      members: [alice()],
      standups: [],
      activities: commits,
    });

    // Assert
    expect(feed).toEqual([
      {
        kind: "COMMITS",
        id: "commits:user-1:2026-11-02",
        userId: "user-1",
        commitCount: 3,
        summary: "Group standups by day",
        occurredAt: new Date("2026-11-02T21:41:00Z"),
      },
    ]);
  });

  it("splits commits by calendar day in the team timezone, not in UTC", () => {
    // Arrange: both are Nov 3 in UTC, but Nov 2 and Nov 3 in Los Angeles
    const commits = [
      createActivityRecord({
        actorLogin: "alice",
        occurredAt: new Date("2026-11-03T07:30:00Z"), // Nov 2, 11:30 PM PST
      }),
      createActivityRecord({
        actorLogin: "alice",
        occurredAt: new Date("2026-11-03T08:30:00Z"), // Nov 3, 12:30 AM PST
      }),
    ];

    // Act
    const feed = buildActivityFeed({
      sprint,
      timeZone,
      members: [alice()],
      standups: [],
      activities: commits,
    });

    // Assert
    expect(feed.map((item) => item.id)).toEqual([
      "commits:user-1:2026-11-03",
      "commits:user-1:2026-11-02",
    ]);
  });

  it("keeps different members' commits on the same day apart", () => {
    const commits = [
      createActivityRecord({
        actorLogin: "alice",
        occurredAt: new Date("2026-11-02T17:00:00Z"),
      }),
      createActivityRecord({
        actorLogin: "bob",
        occurredAt: new Date("2026-11-02T18:00:00Z"),
      }),
    ];

    const feed = buildActivityFeed({
      sprint,
      timeZone,
      members: [alice(), bob()],
      standups: [],
      activities: commits,
    });

    expect(feed.map((item) => item.id)).toEqual([
      "commits:user-2:2026-11-02",
      "commits:user-1:2026-11-02",
    ]);
  });

  it("counts a commit SHA once in its group", () => {
    // Counting rule: commits are deduplicated by SHA (AGENTS.md §1)
    const commits = [
      createActivityRecord({ actorLogin: "alice", sha: "abc123" }),
      createActivityRecord({ actorLogin: "alice", sha: "abc123" }),
      createActivityRecord({ actorLogin: "alice", sha: "def456" }),
    ];

    const feed = buildActivityFeed({
      sprint,
      timeZone,
      members: [alice()],
      standups: [],
      activities: commits,
    });

    expect(feed).toHaveLength(1);
    expect(feed[0]).toMatchObject({ kind: "COMMITS", commitCount: 2 });
  });

  it("leaves out activity from logins that aren't on the team", () => {
    // Unmapped logins are stored but not counted (AGENTS.md §2 Settings)
    const activities = [
      createActivityRecord({ actorLogin: "outsider" }),
      createActivityRecord({
        type: "PR_OPENED",
        actorLogin: "outsider",
        prNumber: 7,
        sha: null,
      }),
    ];

    const feed = buildActivityFeed({
      sprint,
      timeZone,
      members: [alice()],
      standups: [],
      activities,
    });

    expect(feed).toEqual([]);
  });

  it("leaves out bot activity", () => {
    // Counting rule: logins ending in [bot] are ignored for every type (AGENTS.md §1)
    const activities = [
      createActivityRecord({ actorLogin: "dependabot[bot]" }),
      createActivityRecord({
        type: "REVIEW",
        actorLogin: "copilot[bot]",
        prNumber: 7,
        prAuthorLogin: "alice",
        sha: null,
      }),
    ];

    const feed = buildActivityFeed({
      sprint,
      timeZone,
      members: [alice()],
      standups: [],
      activities,
    });

    expect(feed).toEqual([]);
  });

  it("leaves out activity from a member with no GitHub login", () => {
    const member = createMember({ userId: "user-1", githubLogin: null });
    const activities = [createActivityRecord({ actorLogin: "alice" })];

    const feed = buildActivityFeed({
      sprint,
      timeZone,
      members: [member],
      standups: [],
      activities,
    });

    expect(feed).toEqual([]);
  });

  it("matches GitHub logins without regard to case", () => {
    const member = createMember({
      userId: "user-1",
      githubLogin: "Odiethebest",
    });
    const activities = [createActivityRecord({ actorLogin: "odiethebest" })];

    const feed = buildActivityFeed({
      sprint,
      timeZone,
      members: [member],
      standups: [],
      activities,
    });

    expect(feed).toHaveLength(1);
    expect(feed[0].userId).toBe("user-1");
  });

  it("leaves out GitHub activity outside the sprint, with boundaries in the team timezone", () => {
    // Arrange: the sprint runs Oct 29 07:00 UTC to Nov 5 07:59:59.999 UTC
    const activities = [
      createActivityRecord({
        type: "PR_OPENED",
        actorLogin: "alice",
        prNumber: 1,
        sha: null,
        occurredAt: new Date("2026-10-29T06:59:59.999Z"),
      }),
      createActivityRecord({
        type: "PR_OPENED",
        actorLogin: "alice",
        prNumber: 2,
        sha: null,
        occurredAt: new Date("2026-11-05T07:59:59.999Z"),
      }),
      createActivityRecord({
        type: "PR_OPENED",
        actorLogin: "alice",
        prNumber: 3,
        sha: null,
        occurredAt: new Date("2026-11-05T08:00:00.000Z"),
      }),
    ];

    // Act
    const feed = buildActivityFeed({
      sprint,
      timeZone,
      members: [alice()],
      standups: [],
      activities,
    });

    // Assert
    expect(feed).toHaveLength(1);
    expect(feed[0]).toMatchObject({ kind: "PR_OPENED", prNumber: 2 });
  });

  it("sorts standups and GitHub activity together, newest first", () => {
    // Arrange
    const standup = createStandupEntry({
      id: "standup-1",
      userId: "user-1",
      createdAt: new Date("2026-11-02T17:05:00Z"),
    });
    const opened = createActivityRecord({
      id: "activity-pr",
      type: "PR_OPENED",
      actorLogin: "alice",
      prNumber: 111,
      sha: null,
      occurredAt: new Date("2026-11-02T21:10:00Z"),
    });
    const review = createActivityRecord({
      id: "activity-review",
      type: "REVIEW",
      actorLogin: "bob",
      prNumber: 111,
      prAuthorLogin: "alice",
      sha: null,
      occurredAt: new Date("2026-11-03T02:10:00Z"),
    });
    const commit = createActivityRecord({
      actorLogin: "bob",
      occurredAt: new Date("2026-11-02T18:00:00Z"),
    });

    // Act
    const feed = buildActivityFeed({
      sprint,
      timeZone,
      members: [alice(), bob()],
      standups: [standup],
      activities: [commit, opened, review],
    });

    // Assert
    expect(feed.map((item) => item.id)).toEqual([
      "activity-review",
      "activity-pr",
      "commits:user-2:2026-11-02",
      "standup-1",
    ]);
  });

  it("keeps only the 20 most recent items", () => {
    // Arrange: 25 PRs opened one hour apart
    const activities = Array.from({ length: 25 }, (_, index) =>
      createActivityRecord({
        id: `activity-${index + 1}`,
        type: "PR_OPENED",
        actorLogin: "alice",
        prNumber: index + 1,
        sha: null,
        occurredAt: new Date(Date.UTC(2026, 10, 1, index)),
      })
    );

    // Act
    const feed = buildActivityFeed({
      sprint,
      timeZone,
      members: [alice()],
      standups: [],
      activities,
    });

    // Assert: PRs 25 down to 6
    expect(ACTIVITY_FEED_LIMIT).toBe(20);
    expect(feed).toHaveLength(20);
    expect(feed[0]).toMatchObject({ prNumber: 25 });
    expect(feed[19]).toMatchObject({ prNumber: 6 });
  });
});
