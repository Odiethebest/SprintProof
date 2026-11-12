import { beforeEach, describe, expect, it } from "vitest";
import type { ActivityRecord } from "@/lib/stats/member-activity";
import { buildSprintSummary } from "@/lib/stats/sprint-summary";
import {
  createActivityRecord,
  createStandup,
  createTeamMember,
  resetActivitySeq,
  resetMemberSeq,
  resetStandupSeq,
} from "../../factories";

const timeZone = "America/Los_Angeles";
const sprint = {
  id: "sprint-1",
  name: "Sprint 1",
  startDate: "2026-10-29",
  endDate: "2026-11-04",
  standupsPerPerson: 3,
  reviewsPerPerson: 5,
};
// Nov 3, noon in Los Angeles: 2 days left, counting today.
const NOV_3_NOON = new Date("2026-11-03T20:00:00Z");
// Nov 5, noon in Los Angeles: the day after the sprint ended.
const NOV_5_NOON = new Date("2026-11-05T20:00:00Z");
// Oct 27, noon in Los Angeles: two days before the sprint starts.
const OCT_27_NOON = new Date("2026-10-27T19:00:00Z");
// Oct 29, 00:00 in Los Angeles: the first instant of the sprint.
const OCT_29_MIDNIGHT = new Date("2026-10-29T07:00:00Z");

describe("buildSprintSummary", () => {
  beforeEach(() => {
    resetMemberSeq();
    resetStandupSeq();
    resetActivitySeq();
  });

  it("lists each member's commits, PRs, standups and reviews", () => {
    // Arrange
    const alice = createTeamMember({
      userId: "user-1",
      name: "Alice Chen",
      githubLogin: "alice",
      role: "LEAD",
    });
    const bob = createTeamMember({
      userId: "user-2",
      name: "Bob Diaz",
      githubLogin: "bob",
      role: "MEMBER",
    });
    const standups = [
      createStandup({
        userId: "user-1",
        date: "2026-10-30",
      }),
      createStandup({
        userId: "user-1",
        date: "2026-10-31",
      }),
      createStandup({
        userId: "user-2",
        date: "2026-11-02",
      }),
    ];
    const activities = [
      createActivityRecord({ type: "COMMIT", actorLogin: "alice" }),
      createActivityRecord({ type: "COMMIT", actorLogin: "alice" }),
      createActivityRecord({ type: "COMMIT", actorLogin: "bob" }),
      createActivityRecord({
        type: "PR_OPENED",
        actorLogin: "alice",
        prNumber: 12,
        prAuthorLogin: "alice",
        sha: null,
      }),
      createActivityRecord({
        type: "REVIEW",
        actorLogin: "bob",
        prNumber: 12,
        prAuthorLogin: "alice",
        sha: null,
      }),
    ];

    // Act
    const summary = buildSprintSummary({
      sprint,
      timeZone,
      members: [alice, bob],
      standups,
      activities,
      now: NOV_3_NOON,
    });

    // Assert: in the members' order, each requirement with its status
    expect(summary.members).toEqual([
      {
        userId: "user-1",
        name: "Alice Chen",
        githubLogin: "alice",
        role: "LEAD",
        commits: 2,
        pullRequests: 1,
        standups: { count: 2, required: 3, remaining: 1, status: "AT_RISK" },
        reviews: { count: 0, required: 5, remaining: 5, status: "AT_RISK" },
      },
      {
        userId: "user-2",
        name: "Bob Diaz",
        githubLogin: "bob",
        role: "MEMBER",
        commits: 1,
        pullRequests: 0,
        standups: { count: 1, required: 3, remaining: 2, status: "AT_RISK" },
        reviews: { count: 1, required: 5, remaining: 4, status: "AT_RISK" },
      },
    ]);
  });

  it("leaves instructors out, since they have no requirements", () => {
    // Arrange
    const members = [
      createTeamMember({ userId: "user-1", role: "LEAD" }),
      createTeamMember({ userId: "user-2", role: "INSTRUCTOR" }),
      createTeamMember({ userId: "user-3", role: "MEMBER" }),
    ];

    // Act
    const summary = buildSprintSummary({
      sprint,
      timeZone,
      members,
      standups: [],
      activities: [],
      now: NOV_3_NOON,
    });

    // Assert
    expect(summary.members.map((member) => member.userId)).toEqual([
      "user-1",
      "user-3",
    ]);
  });

  it("describes a running sprint with its requirements and days left", () => {
    // Act
    const summary = buildSprintSummary({
      sprint,
      timeZone,
      members: [],
      standups: [],
      activities: [],
      now: NOV_3_NOON,
    });

    // Assert
    expect(summary.sprint).toEqual({
      id: "sprint-1",
      name: "Sprint 1",
      startDate: "2026-10-29",
      endDate: "2026-11-04",
      standupsPerPerson: 3,
      reviewsPerPerson: 5,
      state: "CURRENT",
      daysLeft: 2,
    });
  });

  it("marks an ended sprint ENDED with 0 days left and open requirements MISSED", () => {
    // Arrange
    const member = createTeamMember({ userId: "user-1", githubLogin: "alice" });

    // Act
    const summary = buildSprintSummary({
      sprint,
      timeZone,
      members: [member],
      standups: [],
      activities: [],
      now: NOV_5_NOON,
    });

    // Assert
    expect(summary.sprint).toMatchObject({ state: "ENDED", daysLeft: 0 });
    expect(summary.members[0].standups.status).toBe("MISSED");
    expect(summary.members[0].reviews.status).toBe("MISSED");
  });

  it("gives an upcoming sprint no days left, as it gives its requirements no status", () => {
    // Arrange
    const member = createTeamMember({ userId: "user-1", githubLogin: "alice" });

    // Act
    const summary = buildSprintSummary({
      sprint,
      timeZone,
      members: [member],
      standups: [],
      activities: [],
      now: OCT_27_NOON,
    });

    // Assert: not 9 (Nov 4 minus Oct 27, plus 1), more than the sprint's 7 days
    expect(summary.sprint).toMatchObject({ state: "UPCOMING", daysLeft: null });
    expect(summary.members[0].standups.status).toBeNull();
    expect(summary.members[0].reviews.status).toBeNull();
  });

  it("gives no days left until midnight on the first day in the team timezone", () => {
    // Act: 11:59:59.999 PM on Oct 28 in Los Angeles
    const summary = buildSprintSummary({
      sprint,
      timeZone,
      members: [],
      standups: [],
      activities: [],
      now: new Date(OCT_29_MIDNIGHT.getTime() - 1),
    });

    // Assert
    expect(summary.sprint).toMatchObject({ state: "UPCOMING", daysLeft: null });
  });

  it("counts all 7 days left from midnight on the first day", () => {
    // Act
    const summary = buildSprintSummary({
      sprint,
      timeZone,
      members: [],
      standups: [],
      activities: [],
      now: OCT_29_MIDNIGHT,
    });

    // Assert
    expect(summary.sprint).toMatchObject({ state: "CURRENT", daysLeft: 7 });
  });

  it("stamps the counts with the time they were computed", () => {
    // Act
    const summary = buildSprintSummary({
      sprint,
      timeZone,
      members: [],
      standups: [],
      activities: [],
      now: NOV_3_NOON,
    });

    // Assert
    expect(summary.countsAsOf).toEqual(NOV_3_NOON);
  });

  it("returns zero counts for every member in an empty sprint", () => {
    // Arrange
    const member = createTeamMember({ userId: "user-1", githubLogin: "alice" });

    // Act
    const summary = buildSprintSummary({
      sprint,
      timeZone,
      members: [member],
      standups: [],
      activities: [],
      now: new Date("2026-10-29T20:00:00Z"),
    });

    // Assert: 7 days left on day one, so nothing is at risk yet
    expect(summary.members[0]).toMatchObject({
      commits: 0,
      pullRequests: 0,
      standups: { count: 0, required: 3, remaining: 3, status: "ON_TRACK" },
      reviews: { count: 0, required: 5, remaining: 5, status: "ON_TRACK" },
    });
  });

  it("counts standups but no GitHub activity for a member without a GitHub login", () => {
    // Arrange
    const member = createTeamMember({ userId: "user-1", githubLogin: null });
    const standups = [createStandup({ userId: "user-1" })];
    const activities = [
      createActivityRecord({ type: "COMMIT", actorLogin: "user1" }),
    ];

    // Act
    const summary = buildSprintSummary({
      sprint,
      timeZone,
      members: [member],
      standups,
      activities,
      now: NOV_3_NOON,
    });

    // Assert
    expect(summary.members[0]).toMatchObject({
      githubLogin: null,
      commits: 0,
      pullRequests: 0,
      standups: { count: 1 },
      reviews: { count: 0 },
    });
  });

  // Counting rule R3: a review counts whether it approved, requested changes
  // or commented (AGENTS.md §1). The state only changes the feed's wording (#57).
  describe("review state", () => {
    const alice = () =>
      createTeamMember({ userId: "user-1", githubLogin: "alice" });
    const bob = () =>
      createTeamMember({ userId: "user-2", githubLogin: "bob" });

    function bobReviews(
      reviews: {
        prNumber: number;
        reviewState: ActivityRecord["reviewState"];
      }[]
    ) {
      return reviews.map(({ prNumber, reviewState }) =>
        createActivityRecord({
          type: "REVIEW",
          actorLogin: "bob",
          prNumber,
          prAuthorLogin: "alice",
          sha: null,
          reviewState,
        })
      );
    }

    it("counts a review in every state, and one stored without a state, toward PR reviews", () => {
      // Arrange
      const activities = bobReviews([
        { prNumber: 101, reviewState: "APPROVED" },
        { prNumber: 102, reviewState: "CHANGES_REQUESTED" },
        { prNumber: 103, reviewState: "COMMENTED" },
        { prNumber: 104, reviewState: null },
      ]);

      // Act
      const summary = buildSprintSummary({
        sprint,
        timeZone,
        members: [alice(), bob()],
        standups: [],
        activities,
        now: NOV_3_NOON,
      });

      // Assert
      expect(summary.members[1].reviews).toEqual({
        count: 4,
        required: 5,
        remaining: 1,
        status: "AT_RISK",
      });
    });

    it("counts reviews in different states on the same PR as one", () => {
      // Arrange: changes requested, then a comment, then an approval on #101
      const activities = bobReviews([
        { prNumber: 101, reviewState: "CHANGES_REQUESTED" },
        { prNumber: 101, reviewState: "COMMENTED" },
        { prNumber: 101, reviewState: "APPROVED" },
      ]);

      // Act
      const summary = buildSprintSummary({
        sprint,
        timeZone,
        members: [alice(), bob()],
        standups: [],
        activities,
        now: NOV_3_NOON,
      });

      // Assert
      expect(summary.members[1].reviews.count).toBe(1);
    });

    it.each(["APPROVED", "CHANGES_REQUESTED", "COMMENTED"] as const)(
      "doesn't count a %s review on the reviewer's own PR",
      (reviewState) => {
        // Arrange
        const ownReview = createActivityRecord({
          type: "REVIEW",
          actorLogin: "alice",
          prNumber: 101,
          prAuthorLogin: "alice",
          sha: null,
          reviewState,
        });

        // Act
        const summary = buildSprintSummary({
          sprint,
          timeZone,
          members: [alice()],
          standups: [],
          activities: [ownReview],
          now: NOV_3_NOON,
        });

        // Assert
        expect(summary.members[0].reviews.count).toBe(0);
      }
    );
  });
});
