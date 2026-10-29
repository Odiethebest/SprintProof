import { describe, expect, it } from "vitest";
import {
  checkPrReviewQuota,
  countQualifyingPrReviews,
  isBotLogin,
  isSelfReview,
} from "@/lib/checks/pr-review-quota";
import {
  createMockMember,
  createMockPrReview,
  createMockSprint,
} from "../../factories";

describe("PR Review Quota Checks (Rule R3, R4 & R5)", () => {
  const sprint = createMockSprint({
    startDate: "2026-10-29",
    endDate: "2026-11-04",
    prReviewsPerPerson: 5,
    timezone: "America/Los_Angeles",
  });
  const member = createMockMember({
    id: "user-1",
    name: "Alice",
    githubLogin: "alice",
  });

  describe("isBotLogin", () => {
    it("identifies bot accounts ending with [bot]", () => {
      expect(isBotLogin("dependabot[bot]")).toBe(true);
      expect(isBotLogin("github-actions[bot]")).toBe(true);
      expect(isBotLogin("alice")).toBe(false);
      expect(isBotLogin(null)).toBe(false);
      expect(isBotLogin(undefined)).toBe(false);
    });
  });

  describe("isSelfReview", () => {
    it("detects self-reviews by login and by member ID", () => {
      const selfReviewLogin = createMockPrReview({
        reviewerLogin: "alice",
        prAuthorLogin: "alice",
      });
      expect(isSelfReview(member, selfReviewLogin)).toBe(true);

      const selfReviewCase = createMockPrReview({
        reviewerLogin: "Alice",
        prAuthorLogin: "alice",
      });
      expect(isSelfReview(member, selfReviewCase)).toBe(true);

      const selfReviewById = createMockPrReview({
        reviewerId: "user-1",
        prAuthorId: "user-1",
      });
      expect(isSelfReview(member, selfReviewById)).toBe(true);

      const selfReviewMemberId = createMockPrReview({
        reviewerId: "other-id",
        prAuthorId: "user-1",
      });
      expect(isSelfReview(member, selfReviewMemberId)).toBe(true);

      const otherReview = createMockPrReview({
        reviewerLogin: "alice",
        prAuthorLogin: "bob",
      });
      expect(isSelfReview(member, otherReview)).toBe(false);
    });
  });

  describe("countQualifyingPrReviews", () => {
    it("counts distinct PRs reviewed (Rule R3)", () => {
      const reviews = [
        createMockPrReview({
          reviewerLogin: "alice",
          prId: "101",
          prAuthorLogin: "bob",
          submittedAt: new Date("2026-10-30T15:00:00Z"),
        }),
        createMockPrReview({
          reviewerLogin: "alice",
          prId: "102",
          prAuthorLogin: "charlie",
          submittedAt: new Date("2026-10-31T15:00:00Z"),
        }),
      ];

      expect(countQualifyingPrReviews(member, reviews, sprint)).toBe(2);
    });

    it("deduplicates multiple reviews on the same PR to 1 (Rule R3)", () => {
      const reviews = [
        createMockPrReview({
          reviewerLogin: "alice",
          prId: "101",
          prAuthorLogin: "bob",
          state: "COMMENTED",
          submittedAt: new Date("2026-10-30T10:00:00Z"),
        }),
        createMockPrReview({
          reviewerLogin: "alice",
          prId: "101",
          prAuthorLogin: "bob",
          state: "CHANGES_REQUESTED",
          submittedAt: new Date("2026-10-30T14:00:00Z"),
        }),
        createMockPrReview({
          reviewerLogin: "alice",
          prId: "101",
          prAuthorLogin: "bob",
          state: "APPROVED",
          submittedAt: new Date("2026-10-31T10:00:00Z"),
        }),
      ];

      expect(countQualifyingPrReviews(member, reviews, sprint)).toBe(1);
    });

    it("never counts reviews on member's own PR (Rule R3)", () => {
      const reviews = [
        createMockPrReview({
          reviewerLogin: "alice",
          prId: "101",
          prAuthorLogin: "alice", // self review
          submittedAt: new Date("2026-10-30T15:00:00Z"),
        }),
        createMockPrReview({
          reviewerLogin: "alice",
          prId: "102",
          prAuthorLogin: "bob", // valid review
          submittedAt: new Date("2026-10-31T15:00:00Z"),
        }),
      ];

      expect(countQualifyingPrReviews(member, reviews, sprint)).toBe(1);
    });

    it("ignores bot reviews and bot members (Rule R4)", () => {
      const botMember = createMockMember({
        id: "bot-1",
        githubLogin: "dependabot[bot]",
      });

      const reviews = [
        createMockPrReview({
          reviewerLogin: "dependabot[bot]",
          prId: "101",
          prAuthorLogin: "bob",
          submittedAt: new Date("2026-10-30T15:00:00Z"),
        }),
      ];

      expect(countQualifyingPrReviews(botMember, reviews, sprint)).toBe(0);
      expect(countQualifyingPrReviews(member, reviews, sprint)).toBe(0);
    });

    it("ignores reviews outside the sprint window", () => {
      const reviews = [
        createMockPrReview({
          reviewerLogin: "alice",
          prId: "100",
          prAuthorLogin: "bob",
          submittedAt: new Date("2026-10-28T23:59:59Z"), // before sprint
        }),
        createMockPrReview({
          reviewerLogin: "alice",
          prId: "101",
          prAuthorLogin: "bob",
          submittedAt: new Date("2026-10-30T15:00:00Z"), // inside sprint
        }),
        createMockPrReview({
          reviewerLogin: "alice",
          prId: "102",
          prAuthorLogin: "bob",
          submittedAt: new Date("2026-11-05T09:00:00Z"), // after sprint
        }),
      ];

      expect(countQualifyingPrReviews(member, reviews, sprint)).toBe(1);
    });

    it("ignores PENDING and DISMISSED review states", () => {
      const reviews = [
        createMockPrReview({
          reviewerLogin: "alice",
          prId: "101",
          prAuthorLogin: "bob",
          state: "PENDING", // draft
          submittedAt: new Date("2026-10-30T15:00:00Z"),
        }),
        createMockPrReview({
          reviewerLogin: "alice",
          prId: "102",
          prAuthorLogin: "bob",
          state: "DISMISSED",
          submittedAt: new Date("2026-10-30T15:00:00Z"),
        }),
        createMockPrReview({
          reviewerLogin: "alice",
          prId: "103",
          prAuthorLogin: "bob",
          state: "APPROVED",
          submittedAt: new Date("2026-10-30T15:00:00Z"),
        }),
      ];

      expect(countQualifyingPrReviews(member, reviews, sprint)).toBe(1);
    });

    it("handles member with no GitHub login safely", () => {
      const noGithubMember = createMockMember({
        id: "user-no-gh",
        githubLogin: null,
      });

      const reviews = [
        createMockPrReview({
          reviewerLogin: "bob",
          prId: "101",
          prAuthorLogin: "charlie",
          submittedAt: new Date("2026-10-30T15:00:00Z"),
        }),
      ];

      expect(countQualifyingPrReviews(noGithubMember, reviews, sprint)).toBe(0);
    });

    it("matches reviews by reviewerId when member and review have matching IDs", () => {
      const memberById = createMockMember({
        id: "user-id-only",
        githubLogin: null,
      });

      const reviews = [
        createMockPrReview({
          reviewerId: "user-id-only",
          reviewerLogin: undefined,
          prId: "101",
          prAuthorLogin: "bob",
          submittedAt: new Date("2026-10-30T15:00:00Z"),
        }),
      ];

      expect(countQualifyingPrReviews(memberById, reviews, sprint)).toBe(1);
    });

    it("ignores reviews without valid timestamp or without prId", () => {
      const reviews = [
        {
          reviewerLogin: "alice",
          prId: "101",
          prAuthorLogin: "bob",
          // missing submittedAt
        },
        {
          reviewerLogin: "alice",
          prId: "",
          prAuthorLogin: "bob",
          submittedAt: new Date("2026-10-30T15:00:00Z"),
        },
      ];

      expect(countQualifyingPrReviews(member, reviews, sprint)).toBe(0);
    });
  });

  describe("checkPrReviewQuota", () => {
    it("returns MET when count >= required", () => {
      const reviews = [1, 2, 3, 4, 5].map((num) =>
        createMockPrReview({
          reviewerLogin: "alice",
          prId: `pr-${num}`,
          prAuthorLogin: "bob",
          submittedAt: new Date("2026-10-30T15:00:00Z"),
        })
      );

      const result = checkPrReviewQuota(member, reviews, sprint, {
        now: new Date("2026-10-31T12:00:00Z"),
      });

      expect(result.status).toBe("MET");
      expect(result.isMet).toBe(true);
      expect(result.count).toBe(5);
      expect(result.target).toBe(5);
      expect(result.remaining).toBe(0);
      expect(result.message).toBe("Met");
    });

    it("returns ON_TRACK when count < required and >2 days left", () => {
      const reviews = [1, 2].map((num) =>
        createMockPrReview({
          reviewerLogin: "alice",
          prId: `pr-${num}`,
          prAuthorLogin: "bob",
          submittedAt: new Date("2026-10-30T15:00:00Z"),
        })
      );

      // On Oct 30, sprint ends Nov 4 (5 days left > 2)
      const result = checkPrReviewQuota(member, reviews, sprint, {
        now: new Date("2026-10-30T12:00:00Z"),
      });

      expect(result.status).toBe("ON_TRACK");
      expect(result.isMet).toBe(false);
      expect(result.count).toBe(2);
      expect(result.target).toBe(5);
      expect(result.remaining).toBe(3);
      expect(result.message).toBe("3 PR reviews to go");
    });

    it("returns AT_RISK when count < required and <=2 days left", () => {
      const reviews = [1, 2].map((num) =>
        createMockPrReview({
          reviewerLogin: "alice",
          prId: `pr-${num}`,
          prAuthorLogin: "bob",
          submittedAt: new Date("2026-10-30T15:00:00Z"),
        })
      );

      // On Nov 2, sprint ends Nov 4 (2 days left <= 2)
      const result = checkPrReviewQuota(member, reviews, sprint, {
        now: new Date("2026-11-02T12:00:00Z"),
      });

      expect(result.status).toBe("AT_RISK");
      expect(result.isMet).toBe(false);
      expect(result.remaining).toBe(3);
      expect(result.message).toBe("3 PR reviews to go");
    });

    it("returns MISSED when count < required and sprint ended", () => {
      const reviews = [1, 2, 3, 4].map((num) =>
        createMockPrReview({
          reviewerLogin: "alice",
          prId: `pr-${num}`,
          prAuthorLogin: "bob",
          submittedAt: new Date("2026-10-30T15:00:00Z"),
        })
      );

      // On Nov 5, sprint ended
      const result = checkPrReviewQuota(member, reviews, sprint, {
        now: new Date("2026-11-05T12:00:00Z"),
      });

      expect(result.status).toBe("MISSED");
      expect(result.isMet).toBe(false);
      expect(result.count).toBe(4);
      expect(result.remaining).toBe(1);
      expect(result.message).toBe("1 PR review to go");
    });

    it("uses precomputedCount when provided directly", () => {
      const result = checkPrReviewQuota(member, [], sprint, {
        precomputedCount: 5,
        now: new Date("2026-10-30T12:00:00Z"),
      });

      expect(result.count).toBe(5);
      expect(result.status).toBe("MET");
      expect(result.isMet).toBe(true);
    });
  });
});
