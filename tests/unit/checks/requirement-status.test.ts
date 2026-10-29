import { describe, expect, it } from "vitest";
import { computeRequirementStatus } from "@/lib/checks/requirement-status";
import {
  buildActivity,
  buildMember,
  buildReviewActivity,
  buildSprint,
  buildStandup,
} from "tests/factories";

describe("computeRequirementStatus", () => {
  describe("empty sprint and members with no activity", () => {
    it("returns zero counts and correct remaining when sprint has no activity", () => {
      // Arrange
      const sprint = buildSprint({
        standupsPerPerson: 3,
        reviewsPerPerson: 5,
      });
      const member = buildMember({ id: "member-1" });
      const now = new Date("2026-10-30T12:00:00.000Z");

      // Act
      const result = computeRequirementStatus(sprint, [member], [], [], now);

      // Assert
      expect(result).toHaveLength(1);
      const memberStatus = result[0];
      expect(memberStatus.standups).toEqual({
        count: 0,
        required: 3,
        remaining: 3,
        status: "ON_TRACK",
      });
      expect(memberStatus.reviews).toEqual({
        count: 0,
        required: 5,
        remaining: 5,
        status: "ON_TRACK",
      });
    });

    it("returns zero counts for a member with no activity when other members have activity", () => {
      // Arrange
      const sprint = buildSprint();
      const activeMember = buildMember({ id: "active-1", githubLogin: "alice" });
      const inactiveMember = buildMember({ id: "inactive-2", githubLogin: "bob" });
      const standup = buildStandup({
        memberId: "active-1",
        createdAt: "2026-10-29T19:00:00.000Z",
      });
      const review = buildReviewActivity({
        actor: "alice",
        githubLogin: "alice",
        prNumber: 42,
        prAuthor: "charlie",
        createdAt: "2026-10-29T20:00:00.000Z",
      });
      const now = new Date("2026-10-30T12:00:00.000Z");

      // Act
      const result = computeRequirementStatus(
        sprint,
        [activeMember, inactiveMember],
        [standup],
        [review],
        now
      );

      // Assert
      const inactiveStatus = result.find((item) => item.memberId === "inactive-2");
      expect(inactiveStatus).toBeDefined();
      expect(inactiveStatus!.standups.count).toBe(0);
      expect(inactiveStatus!.standups.remaining).toBe(3);
      expect(inactiveStatus!.reviews.count).toBe(0);
      expect(inactiveStatus!.reviews.remaining).toBe(5);
    });
  });

  describe("standup counting rules (R1, R2)", () => {
    it("counts at most one standup per member per calendar day in the team timezone", () => {
      // Arrange
      const sprint = buildSprint({ timezone: "America/Los_Angeles" });
      const member = buildMember({ id: "member-1" });
      // Two standups on same LA calendar day (2026-10-29): 9 AM PDT (16:00 UTC) and 5 PM PDT (00:00 UTC next day)
      const morningStandup = buildStandup({
        id: "standup-morning",
        memberId: "member-1",
        createdAt: "2026-10-29T16:00:00.000Z",
      });
      const eveningStandup = buildStandup({
        id: "standup-evening",
        memberId: "member-1",
        createdAt: "2026-10-30T00:00:00.000Z", // 5 PM PDT on 2026-10-29
      });
      const now = new Date("2026-10-30T12:00:00.000Z");

      // Act
      const result = computeRequirementStatus(
        sprint,
        [member],
        [morningStandup, eveningStandup],
        [],
        now
      );

      // Assert
      expect(result[0].standups.count).toBe(1);
    });

    it("counts standups on separate calendar days independently", () => {
      // Arrange
      const sprint = buildSprint({ timezone: "America/Los_Angeles" });
      const member = buildMember({ id: "member-1" });
      const day1 = buildStandup({
        id: "s1",
        memberId: "member-1",
        createdAt: "2026-10-29T18:00:00.000Z",
      });
      const day2 = buildStandup({
        id: "s2",
        memberId: "member-1",
        createdAt: "2026-10-30T18:00:00.000Z",
      });
      const day3 = buildStandup({
        id: "s3",
        memberId: "member-1",
        createdAt: "2026-10-31T18:00:00.000Z",
      });
      const now = new Date("2026-11-01T12:00:00.000Z");

      // Act
      const result = computeRequirementStatus(
        sprint,
        [member],
        [day1, day2, day3],
        [],
        now
      );

      // Assert
      expect(result[0].standups.count).toBe(3);
      expect(result[0].standups.remaining).toBe(0);
      expect(result[0].standups.status).toBe("MET");
    });

    it("respects sprint boundaries at 23:59 and 00:00 in team timezone", () => {
      // Arrange
      // Sprint: Oct 29, 2026 to Nov 04, 2026 in America/Los_Angeles
      // Start boundary in UTC: 2026-10-29 00:00 PDT = 2026-10-29 07:00:00 UTC
      // End boundary in UTC: 2026-11-04 23:59:59.999 PST = 2026-11-05 07:59:59.999 UTC
      const sprint = buildSprint({
        startDate: "2026-10-29",
        endDate: "2026-11-04",
        timezone: "America/Los_Angeles",
      });
      const member = buildMember({ id: "member-1" });

      // Standup at 23:59 on the day before the sprint (Oct 28 23:59:59 PDT = 2026-10-29 06:59:59 UTC) -> EXCLUDED
      const justBeforeStart = buildStandup({
        id: "s-before",
        memberId: "member-1",
        createdAt: "2026-10-29T06:59:59.000Z",
      });
      // Standup at 00:00 on the sprint start date (Oct 29 00:00:00 PDT = 2026-10-29 07:00:00 UTC) -> INCLUDED
      const exactlyAtStart = buildStandup({
        id: "s-start",
        memberId: "member-1",
        createdAt: "2026-10-29T07:00:00.000Z",
      });
      // Standup at 23:59 on the sprint end date (Nov 04 23:59:00 PST = 2026-11-05 07:59:00 UTC) -> INCLUDED
      const nearEnd = buildStandup({
        id: "s-end",
        memberId: "member-1",
        createdAt: "2026-11-05T07:59:00.000Z",
      });
      // Standup at 00:00 on the day after the sprint (Nov 05 00:00:00 PST = 2026-11-05 08:00:00 UTC) -> EXCLUDED
      const justAfterEnd = buildStandup({
        id: "s-after",
        memberId: "member-1",
        createdAt: "2026-11-05T08:00:00.000Z",
      });

      const now = new Date("2026-11-01T12:00:00.000Z");

      // Act
      const result = computeRequirementStatus(
        sprint,
        [member],
        [justBeforeStart, exactlyAtStart, nearEnd, justAfterEnd],
        [],
        now
      );

      // Assert: only s-start and s-end are within the boundary on distinct days
      expect(result[0].standups.count).toBe(2);
    });
  });

  describe("PR review counting rules (R3, R4)", () => {
    it("counts multiple reviews on the same PR as one distinct review", () => {
      // Arrange
      const sprint = buildSprint();
      const member = buildMember({ id: "member-1", githubLogin: "alice" });
      const review1 = buildReviewActivity({
        id: "r1",
        githubLogin: "alice",
        prNumber: 101,
        prAuthor: "bob",
        createdAt: "2026-10-29T18:00:00.000Z",
      });
      const review2 = buildReviewActivity({
        id: "r2",
        githubLogin: "alice",
        prNumber: 101,
        prAuthor: "bob",
        createdAt: "2026-10-30T18:00:00.000Z",
      });
      const review3 = buildReviewActivity({
        id: "r3",
        githubLogin: "alice",
        prNumber: 101,
        prAuthor: "bob",
        createdAt: "2026-10-31T18:00:00.000Z",
      });
      const now = new Date("2026-11-01T12:00:00.000Z");

      // Act
      const result = computeRequirementStatus(
        sprint,
        [member],
        [],
        [review1, review2, review3],
        now
      );

      // Assert
      expect(result[0].reviews.count).toBe(1);
    });

    it("excludes reviews on the member's own PR", () => {
      // Arrange
      const sprint = buildSprint();
      const member = buildMember({ id: "member-1", githubLogin: "alice" });
      const ownPrReview = buildReviewActivity({
        id: "r-own",
        githubLogin: "alice",
        prNumber: 201,
        prAuthor: "alice",
        prAuthorLogin: "alice",
        createdAt: "2026-10-29T18:00:00.000Z",
      });
      const otherPrReview = buildReviewActivity({
        id: "r-other",
        githubLogin: "alice",
        prNumber: 202,
        prAuthor: "bob",
        prAuthorLogin: "bob",
        createdAt: "2026-10-30T18:00:00.000Z",
      });
      const now = new Date("2026-11-01T12:00:00.000Z");

      // Act
      const result = computeRequirementStatus(
        sprint,
        [member],
        [],
        [ownPrReview, otherPrReview],
        now
      );

      // Assert: only the review on Bob's PR counts
      expect(result[0].reviews.count).toBe(1);
    });

    it("ignores activity from bot logins ending in [bot]", () => {
      // Arrange
      const sprint = buildSprint();
      const member = buildMember({ id: "member-1", githubLogin: "alice" });
      const botReview = buildReviewActivity({
        id: "r-bot",
        githubLogin: "dependabot[bot]",
        actor: "dependabot[bot]",
        prNumber: 301,
        prAuthor: "alice",
        createdAt: "2026-10-29T18:00:00.000Z",
      });
      const validReview = buildReviewActivity({
        id: "r-valid",
        githubLogin: "alice",
        actor: "alice",
        prNumber: 302,
        prAuthor: "bob",
        createdAt: "2026-10-30T18:00:00.000Z",
      });
      const now = new Date("2026-11-01T12:00:00.000Z");

      // Act
      const result = computeRequirementStatus(
        sprint,
        [member],
        [],
        [botReview, validReview],
        now
      );

      // Assert
      expect(result[0].reviews.count).toBe(1);
    });
  });

  describe("status calculation rules (R5)", () => {
    it("returns MET when count meets or exceeds requirement, even if sprint ended", () => {
      // Arrange
      const sprint = buildSprint({
        standupsPerPerson: 3,
        endDate: "2026-11-04",
      });
      const member = buildMember({ id: "member-1" });
      const s1 = buildStandup({ createdAt: "2026-10-29T18:00:00.000Z" });
      const s2 = buildStandup({ createdAt: "2026-10-30T18:00:00.000Z" });
      const s3 = buildStandup({ createdAt: "2026-10-31T18:00:00.000Z" });
      const s4 = buildStandup({ createdAt: "2026-11-01T18:00:00.000Z" });
      // Sprint ended on Nov 4, now is Nov 6
      const now = new Date("2026-11-06T12:00:00.000Z");

      // Act
      const result = computeRequirementStatus(
        sprint,
        [member],
        [s1, s2, s3, s4],
        [],
        now
      );

      // Assert
      expect(result[0].standups.count).toBe(4);
      expect(result[0].standups.remaining).toBe(0);
      expect(result[0].standups.status).toBe("MET");
    });

    it("returns ON_TRACK when count is below requirement and more than 2 days remain", () => {
      // Arrange
      // Sprint: Oct 29 to Nov 04 (ends Nov 04 23:59:59.999 PST)
      // Now: Oct 30 12:00:00 PDT -> 5 calendar days left (> 2 days)
      const sprint = buildSprint({
        startDate: "2026-10-29",
        endDate: "2026-11-04",
        standupsPerPerson: 3,
        timezone: "America/Los_Angeles",
      });
      const member = buildMember({ id: "member-1" });
      const s1 = buildStandup({ createdAt: "2026-10-29T18:00:00.000Z" });
      const now = new Date("2026-10-30T19:00:00.000Z"); // Oct 30 12:00 PDT

      // Act
      const result = computeRequirementStatus(sprint, [member], [s1], [], now);

      // Assert
      expect(result[0].standups.count).toBe(1);
      expect(result[0].standups.remaining).toBe(2);
      expect(result[0].standups.status).toBe("ON_TRACK");
    });

    it("returns AT_RISK when count is below requirement and 2 or fewer days remain", () => {
      // Arrange
      // Sprint ends Nov 04 in America/Los_Angeles
      // Now: Nov 02 12:00:00 PST -> 2 calendar days left (Nov 3 and Nov 4)
      const sprint = buildSprint({
        startDate: "2026-10-29",
        endDate: "2026-11-04",
        standupsPerPerson: 3,
        timezone: "America/Los_Angeles",
      });
      const member = buildMember({ id: "member-1" });
      const s1 = buildStandup({ createdAt: "2026-10-29T18:00:00.000Z" });
      const now = new Date("2026-11-02T20:00:00.000Z"); // Nov 02 12:00 PST

      // Act
      const result = computeRequirementStatus(sprint, [member], [s1], [], now);

      // Assert
      expect(result[0].standups.count).toBe(1);
      expect(result[0].standups.remaining).toBe(2);
      expect(result[0].standups.status).toBe("AT_RISK");
    });

    it("returns MISSED when count is below requirement and sprint has ended", () => {
      // Arrange
      // Sprint ended Nov 04 23:59:59.999 PST = Nov 05 07:59:59.999 UTC
      // Now: Nov 05 12:00:00 UTC (sprint has ended)
      const sprint = buildSprint({
        startDate: "2026-10-29",
        endDate: "2026-11-04",
        standupsPerPerson: 3,
        timezone: "America/Los_Angeles",
      });
      const member = buildMember({ id: "member-1" });
      const s1 = buildStandup({ createdAt: "2026-10-29T18:00:00.000Z" });
      const now = new Date("2026-11-05T12:00:00.000Z");

      // Act
      const result = computeRequirementStatus(sprint, [member], [s1], [], now);

      // Assert
      expect(result[0].standups.count).toBe(1);
      expect(result[0].standups.remaining).toBe(2);
      expect(result[0].standups.status).toBe("MISSED");
    });
  });

  describe("API flexibility and options object", () => {
    it("accepts an options object as a single argument", () => {
      // Arrange
      const sprint = buildSprint();
      const member = buildMember({ id: "member-1" });
      const now = new Date("2026-10-30T12:00:00.000Z");

      // Act
      const result = computeRequirementStatus({
        sprint,
        members: [member],
        standups: [],
        activities: [],
        now,
      });

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].memberId).toBe("member-1");
    });

    it("allows indexing result by memberId directly", () => {
      // Arrange
      const sprint = buildSprint();
      const member = buildMember({ id: "alice-id" });
      const now = new Date("2026-10-30T12:00:00.000Z");

      // Act
      const result = computeRequirementStatus(sprint, [member], [], [], now);

      // Assert
      expect(result["alice-id"]).toBeDefined();
      expect(result["alice-id"].memberId).toBe("alice-id");
    });
  });
});
