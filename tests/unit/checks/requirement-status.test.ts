import { describe, expect, it } from "vitest";
import { TZDate } from "@date-fns/tz";
import {
  computeRequirementStatus,
  type MemberRequirementStatus,
} from "@/lib/checks/requirement-status";
import {
  createActivity,
  createMember,
  createSprint,
  createStandup,
} from "../../factories";

describe("computeRequirementStatus", () => {
  const timezone = "America/Los_Angeles";
  // Sprint 1: Oct 29, 2026 00:00:00 to Nov 4, 2026 23:59:59.999
  const defaultSprint = createSprint({
    startDate: "2026-10-29",
    endDate: "2026-11-04",
    standupsPerPerson: 3,
    reviewsPerPerson: 5,
    timezone,
  });

  it("handles empty sprint with no standups and no activities", () => {
    // Arrange
    const member = createMember({ id: "mem-1", githubLogin: "alice" });
    const now = new TZDate("2026-10-30T12:00:00", timezone);

    // Act
    const results = computeRequirementStatus(
      defaultSprint,
      [member],
      [],
      [],
      now
    );

    // Assert
    expect(results).toHaveLength(1);
    const memberResult = results[0];
    expect(memberResult.memberId).toBe("mem-1");

    expect(memberResult.standups).toEqual({
      count: 0,
      required: 3,
      remaining: 3,
      status: "ON_TRACK",
    });

    expect(memberResult.reviews).toEqual({
      count: 0,
      required: 5,
      remaining: 5,
      status: "ON_TRACK",
    });
  });

  it("handles member with no activity while other members have activity", () => {
    // Arrange
    const activeMember = createMember({ id: "mem-1", githubLogin: "alice" });
    const inactiveMember = createMember({ id: "mem-2", githubLogin: "bob" });
    const now = new TZDate("2026-10-31T12:00:00", timezone);

    const standup = createStandup({
      userId: activeMember.id,
      createdAt: "2026-10-30T10:00:00-07:00",
    });
    const review = createActivity({
      userId: activeMember.id,
      actorLogin: "alice",
      githubLogin: "alice",
      prNumber: 1,
      prAuthorLogin: "charlie",
      createdAt: "2026-10-30T14:00:00-07:00",
    });

    // Act
    const results = computeRequirementStatus(
      defaultSprint,
      [activeMember, inactiveMember],
      [standup],
      [review],
      now
    );

    // Assert
    expect(results).toHaveLength(2);
    const inactiveResult = results.find((r) => r.memberId === "mem-2");
    expect(inactiveResult).toBeDefined();
    expect(inactiveResult?.standups.count).toBe(0);
    expect(inactiveResult?.standups.remaining).toBe(3);
    expect(inactiveResult?.reviews.count).toBe(0);
    expect(inactiveResult?.reviews.remaining).toBe(5);
  });

  it("counts multiple reviews on the same PR as one distinct review (R3)", () => {
    // Arrange
    const member = createMember({ id: "mem-1", githubLogin: "alice" });
    const now = new TZDate("2026-10-30T12:00:00", timezone);

    // 3 reviews submitted on PR #42 (e.g. comment, changes requested, approved)
    const reviews = [
      createActivity({
        userId: member.id,
        actorLogin: "alice",
        prNumber: 42,
        prAuthorLogin: "bob",
        createdAt: "2026-10-29T10:00:00-07:00",
      }),
      createActivity({
        userId: member.id,
        actorLogin: "alice",
        prNumber: 42,
        prAuthorLogin: "bob",
        createdAt: "2026-10-30T11:00:00-07:00",
      }),
      createActivity({
        userId: member.id,
        actorLogin: "alice",
        prNumber: 42,
        prAuthorLogin: "bob",
        createdAt: "2026-10-30T15:00:00-07:00",
      }),
    ];

    // Act
    const results = computeRequirementStatus(
      defaultSprint,
      [member],
      [],
      reviews,
      now
    );

    // Assert
    expect(results[0].reviews.count).toBe(1);
    expect(results[0].reviews.remaining).toBe(4);
  });

  it("does not count reviews on member's own PR (R3)", () => {
    // Arrange
    const member = createMember({ id: "mem-1", githubLogin: "alice" });
    const now = new TZDate("2026-10-30T12:00:00", timezone);

    // Alice reviews a PR where Alice is author
    const selfReview = createActivity({
      userId: member.id,
      actorLogin: "alice",
      prNumber: 50,
      prAuthorLogin: "alice",
      createdAt: "2026-10-30T12:00:00-07:00",
    });

    // Alice reviews a PR where Bob is author
    const validReview = createActivity({
      userId: member.id,
      actorLogin: "alice",
      prNumber: 51,
      prAuthorLogin: "bob",
      createdAt: "2026-10-30T14:00:00-07:00",
    });

    // Act
    const results = computeRequirementStatus(
      defaultSprint,
      [member],
      [],
      [selfReview, validReview],
      now
    );

    // Assert
    expect(results[0].reviews.count).toBe(1);
  });

  it("ignores activity from bot logins ending in [bot] (R4)", () => {
    // Arrange
    const member = createMember({
      id: "mem-bot",
      githubLogin: "dependabot[bot]",
    });
    const humanMember = createMember({ id: "mem-1", githubLogin: "alice" });
    const now = new TZDate("2026-10-30T12:00:00", timezone);

    const botReview = createActivity({
      userId: "mem-bot",
      actorLogin: "dependabot[bot]",
      prNumber: 10,
      prAuthorLogin: "alice",
      createdAt: "2026-10-30T10:00:00-07:00",
    });

    const botActionReview = createActivity({
      userId: "mem-actions",
      actorLogin: "github-actions[bot]",
      prNumber: 11,
      prAuthorLogin: "alice",
      createdAt: "2026-10-30T11:00:00-07:00",
    });

    // Act
    const results = computeRequirementStatus(
      defaultSprint,
      [member, humanMember],
      [],
      [botReview, botActionReview],
      now
    );

    // Assert
    const botResult = results.find((r) => r.memberId === "mem-bot");
    expect(botResult?.reviews.count).toBe(0);
    const humanResult = results.find((r) => r.memberId === "mem-1");
    expect(humanResult?.reviews.count).toBe(0);
  });

  it("counts standups at exactly 00:00 on start date and 23:59 on end date boundaries (R1, R2)", () => {
    // Arrange
    const member = createMember({ id: "mem-1", githubLogin: "alice" });
    const now = new TZDate("2026-11-04T12:00:00", timezone);

    // Sprint: 2026-10-29 to 2026-11-04 in America/Los_Angeles
    // Oct 28 23:59:59 PDT -> Outside (1 second before sprint)
    const justBeforeSprint = createStandup({
      id: "s-before",
      userId: member.id,
      createdAt: "2026-10-28T23:59:59-07:00",
    });

    // Oct 29 00:00:00 PDT -> Exactly on sprint start boundary (inside)
    const onStartBoundary = createStandup({
      id: "s-start",
      userId: member.id,
      createdAt: "2026-10-29T00:00:00-07:00",
    });

    // Nov 04 23:59:59 PST -> Exactly on sprint end boundary (inside)
    const onEndBoundary = createStandup({
      id: "s-end",
      userId: member.id,
      createdAt: "2026-11-04T23:59:59-08:00",
    });

    // Nov 05 00:00:00 PST -> Outside (first second of next day)
    const justAfterSprint = createStandup({
      id: "s-after",
      userId: member.id,
      createdAt: "2026-11-05T00:00:00-08:00",
    });

    // Act
    const results = computeRequirementStatus(
      defaultSprint,
      [member],
      [justBeforeSprint, onStartBoundary, onEndBoundary, justAfterSprint],
      [],
      now
    );

    // Assert
    // Only onStartBoundary (Oct 29) and onEndBoundary (Nov 04) should count
    expect(results[0].standups.count).toBe(2);
  });

  it("deduplicates standups to at most one per person per calendar day in team timezone (R2)", () => {
    // Arrange
    const member = createMember({ id: "mem-1", githubLogin: "alice" });
    const now = new TZDate("2026-10-31T12:00:00", timezone);

    // Three standups posted on the same calendar day (2026-10-30 in Los Angeles)
    const standup1 = createStandup({
      id: "s-1",
      userId: member.id,
      createdAt: "2026-10-30T09:00:00-07:00",
    });
    const standup2 = createStandup({
      id: "s-2",
      userId: member.id,
      createdAt: "2026-10-30T14:30:00-07:00",
    });
    const standup3 = createStandup({
      id: "s-3",
      userId: member.id,
      createdAt: "2026-10-30T23:45:00-07:00",
    });

    // Standup posted on next calendar day (2026-10-31)
    const standupNextDay = createStandup({
      id: "s-4",
      userId: member.id,
      createdAt: "2026-10-31T08:00:00-07:00",
    });

    // Act
    const results = computeRequirementStatus(
      defaultSprint,
      [member],
      [standup1, standup2, standup3, standupNextDay],
      [],
      now
    );

    // Assert
    expect(results[0].standups.count).toBe(2);
  });

  describe("status evaluation (R5)", () => {
    it("returns MET when count is greater than or equal to required", () => {
      // Arrange: required = 3 standups, user has 3 distinct standup days
      const member = createMember({ id: "mem-1" });
      const now = new TZDate("2026-11-01T12:00:00", timezone);

      const standups = [
        createStandup({
          userId: member.id,
          createdAt: "2026-10-29T10:00:00-07:00",
        }),
        createStandup({
          userId: member.id,
          createdAt: "2026-10-30T10:00:00-07:00",
        }),
        createStandup({
          userId: member.id,
          createdAt: "2026-10-31T10:00:00-07:00",
        }),
      ];

      // Act
      const results = computeRequirementStatus(
        defaultSprint,
        [member],
        standups,
        [],
        now
      );

      // Assert
      expect(results[0].standups.status).toBe("MET");
      expect(results[0].standups.remaining).toBe(0);
    });

    it("returns ON_TRACK when requirement is not met, sprint is running, and more than 2 days are left", () => {
      // Arrange: on Nov 1, sprint ends Nov 4 -> 4 days left (> 2 days left)
      const member = createMember({ id: "mem-1" });
      const now = new TZDate("2026-11-01T12:00:00", timezone);

      // Act
      const results = computeRequirementStatus(
        defaultSprint,
        [member],
        [],
        [],
        now
      );

      // Assert
      expect(results[0].standups.status).toBe("ON_TRACK");
      expect(results[0].reviews.status).toBe("ON_TRACK");
    });

    it("returns AT_RISK when requirement is not met, sprint is running, and 2 or fewer days are left", () => {
      // Arrange: on Nov 3, sprint ends Nov 4 -> 2 days left (Nov 3 and Nov 4)
      const member = createMember({ id: "mem-1" });
      const now = new TZDate("2026-11-03T12:00:00", timezone);

      // Act
      const results = computeRequirementStatus(
        defaultSprint,
        [member],
        [],
        [],
        now
      );

      // Assert
      expect(results[0].standups.status).toBe("AT_RISK");
      expect(results[0].reviews.status).toBe("AT_RISK");
    });

    it("returns MISSED when requirement is not met and sprint has ended", () => {
      // Arrange: on Nov 5, sprint ended on Nov 4 23:59:59.999
      const member = createMember({ id: "mem-1" });
      const now = new TZDate("2026-11-05T08:00:00", timezone);

      // Act
      const results = computeRequirementStatus(
        defaultSprint,
        [member],
        [],
        [],
        now
      );

      // Assert
      expect(results[0].standups.status).toBe("MISSED");
      expect(results[0].reviews.status).toBe("MISSED");
    });
  });

  it("handles member without a GitHub login safely", () => {
    // Arrange
    const member = createMember({ id: "mem-no-gh", githubLogin: undefined });
    const now = new TZDate("2026-10-30T12:00:00", timezone);

    const standup = createStandup({
      userId: member.id,
      createdAt: "2026-10-30T10:00:00-07:00",
    });

    // Act
    const results = computeRequirementStatus(
      defaultSprint,
      [member],
      [standup],
      [],
      now
    );

    // Assert
    expect(results[0].standups.count).toBe(1);
    expect(results[0].reviews.count).toBe(0);
  });

  it("supports options object parameter structure and lookup helpers", () => {
    // Arrange
    const member = createMember({ id: "mem-1", githubLogin: "alice" });
    const now = new TZDate("2026-10-30T12:00:00", timezone);
    const standup = createStandup({
      userId: member.id,
      createdAt: "2026-10-30T10:00:00-07:00",
    });

    // Act
    const results = computeRequirementStatus({
      sprint: defaultSprint,
      members: [member],
      standups: [standup],
      activities: [],
      now,
    });

    // Assert
    expect(results.get("mem-1")?.standups.count).toBe(1);
    expect(results.byMemberId["mem-1"]?.standups.count).toBe(1);
    expect(
      (results as Record<string, MemberRequirementStatus>)["mem-1"]?.standups
        .count
    ).toBe(1);
  });

  it("ignores non-review activity and reviews outside the sprint window", () => {
    // Arrange
    const member = createMember({ id: "mem-1", githubLogin: "alice" });
    const now = new TZDate("2026-10-30T12:00:00", timezone);

    const commitActivity = createActivity({
      type: "COMMIT",
      userId: member.id,
      actorLogin: "alice",
      createdAt: "2026-10-30T10:00:00-07:00",
    });

    const beforeSprintReview = createActivity({
      type: "REVIEW",
      userId: member.id,
      actorLogin: "alice",
      prNumber: 99,
      prAuthorLogin: "bob",
      createdAt: "2026-10-28T10:00:00-07:00",
    });

    const afterSprintReview = createActivity({
      type: "REVIEW",
      userId: member.id,
      actorLogin: "alice",
      prNumber: 100,
      prAuthorLogin: "bob",
      createdAt: "2026-11-06T10:00:00-07:00",
    });

    const validReview = createActivity({
      type: "REVIEW",
      userId: member.id,
      actorLogin: "alice",
      prNumber: 101,
      prAuthorLogin: "bob",
      createdAt: "2026-10-30T14:00:00-07:00",
    });

    // Act
    const results = computeRequirementStatus(
      defaultSprint,
      [member],
      [],
      [commitActivity, beforeSprintReview, afterSprintReview, validReview],
      now
    );

    // Assert
    expect(results[0].reviews.count).toBe(1);
  });

  it("handles sprint with Date objects for start and end dates", () => {
    // Arrange
    const sprintWithDates = createSprint({
      startDate: new TZDate("2026-10-29T00:00:00", timezone),
      endDate: new TZDate("2026-11-04T23:59:59.999", timezone),
    });
    const member = createMember({ id: "mem-1" });
    const now = new TZDate("2026-10-30T12:00:00", timezone);

    // Act
    const results = computeRequirementStatus(
      sprintWithDates,
      [member],
      [],
      [],
      now
    );

    // Assert
    expect(results).toHaveLength(1);
    expect(results[0].standups.status).toBe("ON_TRACK");
  });

  it("matches standup and activity by memberId and authorId", () => {
    // Arrange
    const member = createMember({ id: "mem-1", userId: "u-1" });
    const now = new TZDate("2026-10-30T12:00:00", timezone);

    const standupByMemberId = createStandup({
      id: "s-mem",
      userId: undefined,
      memberId: "mem-1",
      createdAt: "2026-10-29T10:00:00-07:00",
    });

    const standupByAuthorId = createStandup({
      id: "s-auth",
      userId: undefined,
      authorId: "mem-1",
      createdAt: "2026-10-30T10:00:00-07:00",
    });

    const ownPrByIdReview = createActivity({
      type: "REVIEW",
      memberId: "mem-1",
      prNumber: 200,
      prAuthorId: "u-1",
      createdAt: "2026-10-30T11:00:00-07:00",
    });

    const otherPrByIdReview = createActivity({
      type: "REVIEW",
      memberId: "mem-1",
      prNumber: 201,
      prAuthorId: "other-user",
      createdAt: "2026-10-30T12:00:00-07:00",
    });

    // Act
    const results = computeRequirementStatus(
      defaultSprint,
      [member],
      [standupByMemberId, standupByAuthorId],
      [ownPrByIdReview, otherPrByIdReview],
      now
    );

    // Assert
    expect(results[0].standups.count).toBe(2);
    expect(results[0].reviews.count).toBe(1);
  });
});
