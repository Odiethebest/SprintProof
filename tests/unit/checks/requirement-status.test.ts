import { beforeEach, describe, expect, it } from "vitest";
import { TZDate } from "@date-fns/tz";
import { computeRequirementStatus } from "@/lib/checks/requirement-status";
import {
  createActivity,
  createMember,
  createSprint,
  createStandup,
  resetActivitySeq,
  resetMemberSeq,
  resetStandupSeq,
} from "../../factories";

describe("computeRequirementStatus", () => {
  const timezone = "America/Los_Angeles";

  beforeEach(() => {
    resetMemberSeq();
    resetStandupSeq();
    resetActivitySeq();
  });

  it("handles an empty sprint with no standups and no activities", () => {
    // Arrange: Sprint Oct 29 - Nov 4, evaluated on Nov 2 (3 days left)
    const sprint = createSprint({
      startDate: new TZDate(2026, 9, 29, timezone),
      endDate: new TZDate(2026, 10, 4, timezone),
      timezone,
      standupsPerPerson: 3,
      reviewsPerPerson: 5,
    });
    const member = createMember({ userId: "user-1", githubLogin: "alice" });
    const now = new TZDate(2026, 10, 2, 10, 0, timezone); // Nov 2, 2026

    // Act
    const results = computeRequirementStatus({
      sprint,
      members: [member],
      standups: [],
      activities: [],
      now,
    });

    // Assert
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({
      userId: "user-1",
      standups: {
        count: 0,
        required: 3,
        remaining: 3,
        status: "ON_TRACK",
      },
      reviews: {
        count: 0,
        required: 5,
        remaining: 5,
        status: "ON_TRACK",
      },
    });
  });

  it("computes status for a member with no activity when others have activity", () => {
    // Arrange
    const sprint = createSprint({ timezone, standupsPerPerson: 3, reviewsPerPerson: 5 });
    const activeMember = createMember({ userId: "user-1", githubLogin: "alice" });
    const inactiveMember = createMember({ userId: "user-2", githubLogin: "bob" });
    const now = new TZDate(2026, 10, 2, 12, 0, timezone);

    const standup = createStandup({
      userId: activeMember.userId,
      createdAt: new TZDate(2026, 9, 30, 9, 0, timezone),
    });
    const review = createActivity({
      actorLogin: activeMember.githubLogin!,
      prNumber: 42,
      prAuthorLogin: "charlie",
      createdAt: new TZDate(2026, 9, 30, 10, 0, timezone),
    });

    // Act
    const results = computeRequirementStatus({
      sprint,
      members: [activeMember, inactiveMember],
      standups: [standup],
      activities: [review],
      now,
    });

    // Assert
    const inactiveResult = results.find((r) => r.userId === inactiveMember.userId);
    expect(inactiveResult).toBeDefined();
    expect(inactiveResult?.standups).toEqual({
      count: 0,
      required: 3,
      remaining: 3,
      status: "ON_TRACK",
    });
    expect(inactiveResult?.reviews).toEqual({
      count: 0,
      required: 5,
      remaining: 5,
      status: "ON_TRACK",
    });
  });

  it("counts three reviews on the same PR as one", () => {
    // Arrange: Member reviews PR #105 three times
    const sprint = createSprint({ timezone, reviewsPerPerson: 5 });
    const member = createMember({ userId: "user-1", githubLogin: "alice" });
    const now = new TZDate(2026, 10, 2, 12, 0, timezone);

    const activities = [
      createActivity({
        actorLogin: "alice",
        prNumber: 105,
        prAuthorLogin: "bob",
        createdAt: new TZDate(2026, 9, 30, 10, 0, timezone),
      }),
      createActivity({
        actorLogin: "alice",
        prNumber: 105,
        prAuthorLogin: "bob",
        createdAt: new TZDate(2026, 10, 1, 11, 0, timezone),
      }),
      createActivity({
        actorLogin: "alice",
        prNumber: 105,
        prAuthorLogin: "bob",
        createdAt: new TZDate(2026, 10, 2, 9, 0, timezone),
      }),
    ];

    // Act
    const results = computeRequirementStatus({
      sprint,
      members: [member],
      standups: [],
      activities,
      now,
    });

    // Assert
    expect(results[0]?.reviews.count).toBe(1);
    expect(results[0]?.reviews.remaining).toBe(4);
  });

  it("does not count reviews on the member's own PR", () => {
    // Arrange: Alice reviews a PR authored by Alice
    const sprint = createSprint({ timezone, reviewsPerPerson: 5 });
    const member = createMember({ userId: "user-1", githubLogin: "alice" });
    const now = new TZDate(2026, 10, 2, 12, 0, timezone);

    const ownPrReview = createActivity({
      actorLogin: "alice",
      prNumber: 201,
      prAuthorLogin: "alice",
      createdAt: new TZDate(2026, 9, 30, 14, 0, timezone),
    });

    // Act
    const results = computeRequirementStatus({
      sprint,
      members: [member],
      standups: [],
      activities: [ownPrReview],
      now,
    });

    // Assert
    expect(results[0]?.reviews.count).toBe(0);
  });

  it("ignores activity from bot logins ending in [bot]", () => {
    // Arrange: Activities from bot accounts
    const sprint = createSprint({ timezone, reviewsPerPerson: 5 });
    const botMember = createMember({ userId: "bot-1", githubLogin: "dependabot[bot]" });
    const humanMember = createMember({ userId: "user-1", githubLogin: "alice" });
    const now = new TZDate(2026, 10, 2, 12, 0, timezone);

    const activities = [
      createActivity({
        actorLogin: "dependabot[bot]",
        prNumber: 301,
        prAuthorLogin: "alice",
        createdAt: new TZDate(2026, 9, 30, 10, 0, timezone),
      }),
      createActivity({
        actorLogin: "github-actions[bot]",
        prNumber: 302,
        prAuthorLogin: "alice",
        createdAt: new TZDate(2026, 9, 30, 11, 0, timezone),
      }),
    ];

    // Act
    const results = computeRequirementStatus({
      sprint,
      members: [botMember, humanMember],
      standups: [],
      activities,
      now,
    });

    // Assert: Bot activity is ignored for bot member and human member
    const botResult = results.find((r) => r.userId === "bot-1");
    expect(botResult?.reviews.count).toBe(0);
    const humanResult = results.find((r) => r.userId === "user-1");
    expect(humanResult?.reviews.count).toBe(0);
  });

  it("excludes standup submitted at 23:59 the day before sprint start", () => {
    // Arrange: Sprint starts 2026-10-29 00:00:00 PDT
    const sprint = createSprint({
      startDate: new TZDate(2026, 9, 29, timezone),
      endDate: new TZDate(2026, 10, 4, timezone),
      timezone,
      standupsPerPerson: 3,
    });
    const member = createMember({ userId: "user-1" });
    const now = new TZDate(2026, 10, 2, 12, 0, timezone);

    const standupBefore = createStandup({
      userId: member.userId,
      createdAt: new TZDate(2026, 9, 28, 23, 59, 59, timezone), // Oct 28 23:59:59 PDT
    });

    // Act
    const results = computeRequirementStatus({
      sprint,
      members: [member],
      standups: [standupBefore],
      activities: [],
      now,
    });

    // Assert
    expect(results[0]?.standups.count).toBe(0);
  });

  it("includes standup submitted at 00:00 on the sprint start date", () => {
    // Arrange: Sprint starts 2026-10-29 00:00:00 PDT
    const sprint = createSprint({
      startDate: new TZDate(2026, 9, 29, timezone),
      endDate: new TZDate(2026, 10, 4, timezone),
      timezone,
      standupsPerPerson: 3,
    });
    const member = createMember({ userId: "user-1" });
    const now = new TZDate(2026, 10, 2, 12, 0, timezone);

    const standupAtStart = createStandup({
      userId: member.userId,
      createdAt: new TZDate(2026, 9, 29, 0, 0, 0, timezone), // Oct 29 00:00:00 PDT
    });

    // Act
    const results = computeRequirementStatus({
      sprint,
      members: [member],
      standups: [standupAtStart],
      activities: [],
      now,
    });

    // Assert
    expect(results[0]?.standups.count).toBe(1);
  });

  it("includes standup submitted at 23:59 on the sprint end date", () => {
    // Arrange: Sprint ends 2026-11-04 23:59:59.999 PST
    const sprint = createSprint({
      startDate: new TZDate(2026, 9, 29, timezone),
      endDate: new TZDate(2026, 10, 4, timezone),
      timezone,
      standupsPerPerson: 3,
    });
    const member = createMember({ userId: "user-1" });
    const now = new TZDate(2026, 10, 4, 23, 59, 59, timezone);

    const standupAtEnd = createStandup({
      userId: member.userId,
      createdAt: new TZDate(2026, 10, 4, 23, 59, 0, timezone), // Nov 4 23:59:00 PST
    });

    // Act
    const results = computeRequirementStatus({
      sprint,
      members: [member],
      standups: [standupAtEnd],
      activities: [],
      now,
    });

    // Assert
    expect(results[0]?.standups.count).toBe(1);
  });

  it("excludes standup submitted at 00:00 the day after sprint end", () => {
    // Arrange: Sprint ended 2026-11-04 23:59:59.999 PST
    const sprint = createSprint({
      startDate: new TZDate(2026, 9, 29, timezone),
      endDate: new TZDate(2026, 10, 4, timezone),
      timezone,
      standupsPerPerson: 3,
    });
    const member = createMember({ userId: "user-1" });
    const now = new TZDate(2026, 10, 5, 12, 0, timezone);

    const standupAfter = createStandup({
      userId: member.userId,
      createdAt: new TZDate(2026, 10, 5, 0, 0, 0, timezone), // Nov 5 00:00:00 PST
    });

    // Act
    const results = computeRequirementStatus({
      sprint,
      members: [member],
      standups: [standupAfter],
      activities: [],
      now,
    });

    // Assert
    expect(results[0]?.standups.count).toBe(0);
  });

  it("counts at most one standup per calendar day in the team timezone", () => {
    // Arrange: Two standups on same calendar day (Oct 30 9am and Oct 30 5pm PDT)
    const sprint = createSprint({ timezone, standupsPerPerson: 3 });
    const member = createMember({ userId: "user-1" });
    const now = new TZDate(2026, 10, 2, 12, 0, timezone);

    const morningStandup = createStandup({
      userId: member.userId,
      createdAt: new TZDate(2026, 9, 30, 9, 0, 0, timezone),
    });
    const eveningStandup = createStandup({
      userId: member.userId,
      createdAt: new TZDate(2026, 9, 30, 17, 0, 0, timezone),
    });

    // Act
    const results = computeRequirementStatus({
      sprint,
      members: [member],
      standups: [morningStandup, eveningStandup],
      activities: [],
      now,
    });

    // Assert
    expect(results[0]?.standups.count).toBe(1);
  });

  it("counts standups on consecutive calendar days as separate standups", () => {
    // Arrange: Oct 30 23:50 PDT and Oct 31 00:10 PDT (crossing midnight in team tz)
    const sprint = createSprint({ timezone, standupsPerPerson: 3 });
    const member = createMember({ userId: "user-1" });
    const now = new TZDate(2026, 10, 2, 12, 0, timezone);

    const standupDay1 = createStandup({
      userId: member.userId,
      createdAt: new TZDate(2026, 9, 30, 23, 50, 0, timezone),
    });
    const standupDay2 = createStandup({
      userId: member.userId,
      createdAt: new TZDate(2026, 9, 31, 0, 10, 0, timezone),
    });

    // Act
    const results = computeRequirementStatus({
      sprint,
      members: [member],
      standups: [standupDay1, standupDay2],
      activities: [],
      now,
    });

    // Assert
    expect(results[0]?.standups.count).toBe(2);
  });

  it("computes MET status when count meets or exceeds required", () => {
    // Arrange: 3 standups submitted, required 3
    const sprint = createSprint({ timezone, standupsPerPerson: 3, reviewsPerPerson: 2 });
    const member = createMember({ userId: "user-1", githubLogin: "alice" });
    const now = new TZDate(2026, 10, 2, 12, 0, timezone);

    const standups = [
      createStandup({ userId: member.userId, createdAt: new TZDate(2026, 9, 29, 9, 0, timezone) }),
      createStandup({ userId: member.userId, createdAt: new TZDate(2026, 9, 30, 9, 0, timezone) }),
      createStandup({ userId: member.userId, createdAt: new TZDate(2026, 10, 1, 9, 0, timezone) }),
    ];
    const reviews = [
      createActivity({ actorLogin: "alice", prNumber: 1, prAuthorLogin: "bob", createdAt: new TZDate(2026, 9, 29, 10, 0, timezone) }),
      createActivity({ actorLogin: "alice", prNumber: 2, prAuthorLogin: "bob", createdAt: new TZDate(2026, 9, 30, 10, 0, timezone) }),
      createActivity({ actorLogin: "alice", prNumber: 3, prAuthorLogin: "bob", createdAt: new TZDate(2026, 10, 1, 10, 0, timezone) }),
    ];

    // Act
    const results = computeRequirementStatus({
      sprint,
      members: [member],
      standups,
      activities: reviews,
      now,
    });

    // Assert: Standups 3/3 => MET, Reviews 3/2 => MET
    expect(results[0]?.standups.status).toBe("MET");
    expect(results[0]?.standups.remaining).toBe(0);
    expect(results[0]?.reviews.status).toBe("MET");
    expect(results[0]?.reviews.remaining).toBe(0);
  });

  it("computes ON_TRACK status when count is below required and more than 2 days remain", () => {
    // Arrange: Sprint ends Nov 4. Today is Nov 2 (3 days left).
    const sprint = createSprint({
      startDate: new TZDate(2026, 9, 29, timezone),
      endDate: new TZDate(2026, 10, 4, timezone),
      timezone,
      standupsPerPerson: 3,
      reviewsPerPerson: 5,
    });
    const member = createMember({ userId: "user-1", githubLogin: "alice" });
    const now = new TZDate(2026, 10, 2, 14, 0, timezone); // Nov 2 has 3 days left

    // Act
    const results = computeRequirementStatus({
      sprint,
      members: [member],
      standups: [],
      activities: [],
      now,
    });

    // Assert
    expect(results[0]?.standups.status).toBe("ON_TRACK");
    expect(results[0]?.reviews.status).toBe("ON_TRACK");
  });

  it("computes AT_RISK status when count is below required and 2 days remain", () => {
    // Arrange: Sprint ends Nov 4. Today is Nov 3 (2 days left).
    const sprint = createSprint({
      startDate: new TZDate(2026, 9, 29, timezone),
      endDate: new TZDate(2026, 10, 4, timezone),
      timezone,
      standupsPerPerson: 3,
      reviewsPerPerson: 5,
    });
    const member = createMember({ userId: "user-1", githubLogin: "alice" });
    const now = new TZDate(2026, 10, 3, 10, 0, timezone); // Nov 3 has 2 days left

    // Act
    const results = computeRequirementStatus({
      sprint,
      members: [member],
      standups: [],
      activities: [],
      now,
    });

    // Assert
    expect(results[0]?.standups.status).toBe("AT_RISK");
    expect(results[0]?.reviews.status).toBe("AT_RISK");
  });

  it("computes AT_RISK status when count is below required and 1 day remains (last day of sprint)", () => {
    // Arrange: Sprint ends Nov 4. Today is Nov 4 (1 day left).
    const sprint = createSprint({
      startDate: new TZDate(2026, 9, 29, timezone),
      endDate: new TZDate(2026, 10, 4, timezone),
      timezone,
      standupsPerPerson: 3,
      reviewsPerPerson: 5,
    });
    const member = createMember({ userId: "user-1", githubLogin: "alice" });
    const now = new TZDate(2026, 10, 4, 18, 0, timezone); // Nov 4 has 1 day left

    // Act
    const results = computeRequirementStatus({
      sprint,
      members: [member],
      standups: [],
      activities: [],
      now,
    });

    // Assert
    expect(results[0]?.standups.status).toBe("AT_RISK");
    expect(results[0]?.reviews.status).toBe("AT_RISK");
  });

  it("computes MISSED status when count is below required and sprint has ended", () => {
    // Arrange: Sprint ended Nov 4. Today is Nov 5 (0 days left, after sprintEnd).
    const sprint = createSprint({
      startDate: new TZDate(2026, 9, 29, timezone),
      endDate: new TZDate(2026, 10, 4, timezone),
      timezone,
      standupsPerPerson: 3,
      reviewsPerPerson: 5,
    });
    const member = createMember({ userId: "user-1", githubLogin: "alice" });
    const now = new TZDate(2026, 10, 5, 9, 0, timezone); // Nov 5 is after sprint end

    // Act
    const results = computeRequirementStatus({
      sprint,
      members: [member],
      standups: [],
      activities: [],
      now,
    });

    // Assert
    expect(results[0]?.standups.status).toBe("MISSED");
    expect(results[0]?.reviews.status).toBe("MISSED");
  });

  it("handles a member with no GitHub login (cannot attribute GitHub reviews)", () => {
    // Arrange: Member with githubLogin = null
    const sprint = createSprint({ timezone, standupsPerPerson: 3, reviewsPerPerson: 5 });
    const member = createMember({ userId: "user-1", githubLogin: null });
    const now = new TZDate(2026, 10, 2, 12, 0, timezone);

    const standup = createStandup({
      userId: member.userId,
      createdAt: new TZDate(2026, 9, 30, 9, 0, timezone),
    });
    const activity = createActivity({
      actorLogin: "unknown-login",
      prNumber: 99,
      prAuthorLogin: "someone",
      createdAt: new TZDate(2026, 9, 30, 10, 0, timezone),
    });

    // Act
    const results = computeRequirementStatus({
      sprint,
      members: [member],
      standups: [standup],
      activities: [activity],
      now,
    });

    // Assert
    expect(results[0]?.standups.count).toBe(1);
    expect(results[0]?.reviews.count).toBe(0);
  });

  it("ignores non-review activity types when counting reviews", () => {
    // Arrange: COMMIT, PR_OPENED, PR_MERGED activities
    const sprint = createSprint({ timezone, reviewsPerPerson: 5 });
    const member = createMember({ userId: "user-1", githubLogin: "alice" });
    const now = new TZDate(2026, 10, 2, 12, 0, timezone);

    const activities = [
      createActivity({
        type: "COMMIT",
        actorLogin: "alice",
        createdAt: new TZDate(2026, 9, 30, 10, 0, timezone),
      }),
      createActivity({
        type: "PR_OPENED",
        actorLogin: "alice",
        prNumber: 101,
        createdAt: new TZDate(2026, 9, 30, 11, 0, timezone),
      }),
      createActivity({
        type: "PR_MERGED",
        actorLogin: "alice",
        prNumber: 101,
        createdAt: new TZDate(2026, 9, 30, 12, 0, timezone),
      }),
    ];

    // Act
    const results = computeRequirementStatus({
      sprint,
      members: [member],
      standups: [],
      activities,
      now,
    });

    // Assert
    expect(results[0]?.reviews.count).toBe(0);
  });

  it("calculates remaining count correctly without negative values", () => {
    // Arrange: Required 3, count 5 -> remaining should be 0, not -2
    const sprint = createSprint({ timezone, standupsPerPerson: 3, reviewsPerPerson: 2 });
    const member = createMember({ userId: "user-1", githubLogin: "alice" });
    const now = new TZDate(2026, 10, 2, 12, 0, timezone);

    const standups = [
      createStandup({ userId: member.userId, createdAt: new TZDate(2026, 9, 29, 9, 0, timezone) }),
      createStandup({ userId: member.userId, createdAt: new TZDate(2026, 9, 30, 9, 0, timezone) }),
      createStandup({ userId: member.userId, createdAt: new TZDate(2026, 10, 1, 9, 0, timezone) }),
      createStandup({ userId: member.userId, createdAt: new TZDate(2026, 10, 2, 9, 0, timezone) }),
    ];

    // Act
    const results = computeRequirementStatus({
      sprint,
      members: [member],
      standups,
      activities: [],
      now,
    });

    // Assert
    expect(results[0]?.standups.count).toBe(4);
    expect(results[0]?.standups.required).toBe(3);
    expect(results[0]?.standups.remaining).toBe(0);
  });
});
