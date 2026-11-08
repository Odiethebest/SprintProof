import { beforeEach, describe, expect, it } from "vitest";
import { countMemberActivity } from "@/lib/stats/member-activity";
import {
  createActivityRecord,
  createMember,
  resetActivitySeq,
  resetMemberSeq,
} from "../../factories";

const timeZone = "America/Los_Angeles";
const sprint = { startDate: "2026-10-29", endDate: "2026-11-04" };

describe("countMemberActivity", () => {
  beforeEach(() => {
    resetMemberSeq();
    resetActivitySeq();
  });

  it("returns zero counts for every member in an empty sprint", () => {
    // Arrange
    const members = [
      createMember({ userId: "user-1", githubLogin: "alice" }),
      createMember({ userId: "user-2", githubLogin: "bob" }),
    ];

    // Act
    const counts = countMemberActivity({
      sprint,
      timeZone,
      members,
      activities: [],
    });

    // Assert: one entry per member, in the members' order
    expect(counts).toEqual([
      { userId: "user-1", commits: 0, pullRequests: 0 },
      { userId: "user-2", commits: 0, pullRequests: 0 },
    ]);
  });

  it("counts each member's commits by author login", () => {
    // Arrange
    const members = [
      createMember({ userId: "user-1", githubLogin: "alice" }),
      createMember({ userId: "user-2", githubLogin: "bob" }),
    ];
    const activities = [
      createActivityRecord({ actorLogin: "alice" }),
      createActivityRecord({ actorLogin: "alice" }),
      createActivityRecord({ actorLogin: "bob" }),
    ];

    // Act
    const counts = countMemberActivity({
      sprint,
      timeZone,
      members,
      activities,
    });

    // Assert
    expect(counts).toEqual([
      { userId: "user-1", commits: 2, pullRequests: 0 },
      { userId: "user-2", commits: 1, pullRequests: 0 },
    ]);
  });

  it("counts a commit SHA once, even when it was stored twice", () => {
    // Counting rule: commits are deduplicated by SHA (AGENTS.md §1)
    const members = [createMember({ userId: "user-1", githubLogin: "alice" })];
    const activities = [
      createActivityRecord({ actorLogin: "alice", sha: "abc123" }),
      createActivityRecord({ actorLogin: "alice", sha: "abc123" }),
      createActivityRecord({ actorLogin: "alice", sha: "def456" }),
    ];

    const counts = countMemberActivity({
      sprint,
      timeZone,
      members,
      activities,
    });

    expect(counts[0].commits).toBe(2);
  });

  it("doesn't count a commit without a SHA, since commits are deduplicated by SHA", () => {
    const members = [createMember({ userId: "user-1", githubLogin: "alice" })];
    const activities = [
      createActivityRecord({ actorLogin: "alice", sha: null }),
    ];

    const counts = countMemberActivity({
      sprint,
      timeZone,
      members,
      activities,
    });

    expect(counts[0].commits).toBe(0);
  });

  it("matches GitHub logins without regard to case", () => {
    const members = [
      createMember({ userId: "user-1", githubLogin: "Odiethebest" }),
    ];
    const activities = [
      createActivityRecord({ actorLogin: "odiethebest" }),
      createActivityRecord({
        type: "PR_OPENED",
        actorLogin: "ODIETHEBEST",
        prNumber: 12,
        sha: null,
      }),
    ];

    const counts = countMemberActivity({
      sprint,
      timeZone,
      members,
      activities,
    });

    expect(counts).toEqual([{ userId: "user-1", commits: 1, pullRequests: 1 }]);
  });

  it("counts the PRs a member opened, once per PR number", () => {
    const members = [createMember({ userId: "user-1", githubLogin: "alice" })];
    const activities = [
      createActivityRecord({
        type: "PR_OPENED",
        actorLogin: "alice",
        prNumber: 10,
        sha: null,
      }),
      createActivityRecord({
        type: "PR_OPENED",
        actorLogin: "alice",
        prNumber: 10,
        sha: null,
      }),
      createActivityRecord({
        type: "PR_OPENED",
        actorLogin: "alice",
        prNumber: 11,
        sha: null,
      }),
    ];

    const counts = countMemberActivity({
      sprint,
      timeZone,
      members,
      activities,
    });

    expect(counts[0].pullRequests).toBe(2);
  });

  it("doesn't count merged PRs or reviews as opened PRs", () => {
    const members = [createMember({ userId: "user-1", githubLogin: "alice" })];
    const activities = [
      createActivityRecord({
        type: "PR_MERGED",
        actorLogin: "alice",
        prNumber: 10,
        sha: null,
      }),
      createActivityRecord({
        type: "REVIEW",
        actorLogin: "alice",
        prNumber: 11,
        prAuthorLogin: "bob",
        sha: null,
      }),
    ];

    const counts = countMemberActivity({
      sprint,
      timeZone,
      members,
      activities,
    });

    expect(counts).toEqual([{ userId: "user-1", commits: 0, pullRequests: 0 }]);
  });

  it("gives zero counts to a member with no GitHub login", () => {
    const members = [createMember({ userId: "user-1", githubLogin: null })];
    const activities = [
      createActivityRecord({ actorLogin: "alice" }),
      createActivityRecord({
        type: "PR_OPENED",
        actorLogin: "alice",
        prNumber: 10,
        sha: null,
      }),
    ];

    const counts = countMemberActivity({
      sprint,
      timeZone,
      members,
      activities,
    });

    expect(counts).toEqual([{ userId: "user-1", commits: 0, pullRequests: 0 }]);
  });

  it("doesn't credit activity from logins that aren't on the team", () => {
    const members = [createMember({ userId: "user-1", githubLogin: "alice" })];
    const activities = [
      createActivityRecord({ actorLogin: "outsider" }),
      createActivityRecord({ actorLogin: "dependabot[bot]" }),
    ];

    const counts = countMemberActivity({
      sprint,
      timeZone,
      members,
      activities,
    });

    expect(counts).toEqual([{ userId: "user-1", commits: 0, pullRequests: 0 }]);
  });

  it("counts only activity inside the sprint, with boundaries in the team timezone", () => {
    // Arrange: the sprint runs Oct 29 00:00 PDT (07:00 UTC) to Nov 4 23:59:59.999 PST (Nov 5 07:59:59.999 UTC)
    const members = [createMember({ userId: "user-1", githubLogin: "alice" })];
    const activities = [
      createActivityRecord({
        actorLogin: "alice",
        occurredAt: new Date("2026-10-29T06:59:59.999Z"),
      }),
      createActivityRecord({
        actorLogin: "alice",
        occurredAt: new Date("2026-10-29T07:00:00.000Z"),
      }),
      createActivityRecord({
        actorLogin: "alice",
        occurredAt: new Date("2026-11-05T07:59:59.999Z"),
      }),
      createActivityRecord({
        actorLogin: "alice",
        occurredAt: new Date("2026-11-05T08:00:00.000Z"),
      }),
    ];

    // Act
    const counts = countMemberActivity({
      sprint,
      timeZone,
      members,
      activities,
    });

    // Assert: the first and last are outside the sprint
    expect(counts[0].commits).toBe(2);
  });
});
