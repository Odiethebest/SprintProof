import { describe, expect, it } from "vitest";
import {
  checkMemberRequirements,
  checkSprintRequirements,
  checkTeamMemberRequirements,
  checkTeamSprintRequirements,
} from "@/lib/checks/sprint-requirements";
import {
  createMockMember,
  createMockPrReview,
  createMockSprint,
  createMockStandup,
} from "../../factories";

describe("Sprint Requirements Checks (US-5, Issue #10)", () => {
  const sprint = createMockSprint({
    id: "sprint-1",
    startDate: "2026-10-29",
    endDate: "2026-11-04",
    standupsPerPerson: 3,
    prReviewsPerPerson: 5,
    timezone: "America/Los_Angeles",
  });

  const alice = createMockMember({
    id: "alice-id",
    name: "Alice",
    githubLogin: "alice",
  });

  const bob = createMockMember({
    id: "bob-id",
    name: "Bob",
    githubLogin: "bob",
  });

  describe("checkMemberRequirements", () => {
    it("reports isMet: true when both standup and PR review quotas are satisfied", () => {
      const standups = [
        createMockStandup({ memberId: "alice-id", createdAt: new Date("2026-10-29T16:00:00Z") }),
        createMockStandup({ memberId: "alice-id", createdAt: new Date("2026-10-30T16:00:00Z") }),
        createMockStandup({ memberId: "alice-id", createdAt: new Date("2026-10-31T16:00:00Z") }),
      ];

      const prReviews = [1, 2, 3, 4, 5].map((num) =>
        createMockPrReview({
          reviewerLogin: "alice",
          prId: `pr-${num}`,
          prAuthorLogin: "bob",
          submittedAt: new Date("2026-10-30T16:00:00Z"),
        })
      );

      const check = checkMemberRequirements(alice, {
        sprint,
        standups,
        prReviews,
        now: new Date("2026-10-31T18:00:00Z"),
      });

      expect(check.memberId).toBe("alice-id");
      expect(check.name).toBe("Alice");
      expect(check.isMet).toBe(true);
      expect(check.status).toBe("MET");
      expect(check.standups.isMet).toBe(true);
      expect(check.standups.count).toBe(3);
      expect(check.standups.status).toBe("MET");
      expect(check.prReviews.isMet).toBe(true);
      expect(check.prReviews.count).toBe(5);
      expect(check.prReviews.status).toBe("MET");
    });

    it("reports isMet: false when standups are met but PR reviews are short", () => {
      const standups = [
        createMockStandup({ memberId: "alice-id", createdAt: new Date("2026-10-29T16:00:00Z") }),
        createMockStandup({ memberId: "alice-id", createdAt: new Date("2026-10-30T16:00:00Z") }),
        createMockStandup({ memberId: "alice-id", createdAt: new Date("2026-10-31T16:00:00Z") }),
      ];

      const prReviews = [
        createMockPrReview({
          reviewerLogin: "alice",
          prId: "pr-1",
          prAuthorLogin: "bob",
          submittedAt: new Date("2026-10-30T16:00:00Z"),
        }),
      ];

      // On Oct 30, 5 days left (> 2) -> ON_TRACK
      const checkOnTrack = checkMemberRequirements(alice, {
        sprint,
        standups,
        prReviews,
        now: new Date("2026-10-30T18:00:00Z"),
      });

      expect(checkOnTrack.isMet).toBe(false);
      expect(checkOnTrack.standups.isMet).toBe(true);
      expect(checkOnTrack.prReviews.isMet).toBe(false);
      expect(checkOnTrack.status).toBe("ON_TRACK");

      // On Nov 2, 2 days left (<= 2) -> AT_RISK
      const checkAtRisk = checkMemberRequirements(alice, {
        sprint,
        standups,
        prReviews,
        now: new Date("2026-11-02T18:00:00Z"),
      });

      expect(checkAtRisk.isMet).toBe(false);
      expect(checkAtRisk.status).toBe("AT_RISK");

      // On Nov 5, sprint ended -> MISSED
      const checkMissed = checkMemberRequirements(alice, {
        sprint,
        standups,
        prReviews,
        now: new Date("2026-11-05T12:00:00Z"),
      });

      expect(checkMissed.isMet).toBe(false);
      expect(checkMissed.status).toBe("MISSED");
    });
  });

  describe("checkSprintRequirements (team level)", () => {
    it("checks whether each team member met requirements and returns allMet: true when all pass", () => {
      // Alice meets both: 3 standups, 5 PR reviews
      const aliceStandups = [
        createMockStandup({ memberId: "alice-id", createdAt: new Date("2026-10-29T16:00:00Z") }),
        createMockStandup({ memberId: "alice-id", createdAt: new Date("2026-10-30T16:00:00Z") }),
        createMockStandup({ memberId: "alice-id", createdAt: new Date("2026-10-31T16:00:00Z") }),
      ];
      const aliceReviews = [1, 2, 3, 4, 5].map((num) =>
        createMockPrReview({
          reviewerLogin: "alice",
          prId: `pr-a-${num}`,
          prAuthorLogin: "bob",
          submittedAt: new Date("2026-10-30T16:00:00Z"),
        })
      );

      // Bob meets both: 3 standups, 5 PR reviews
      const bobStandups = [
        createMockStandup({ memberId: "bob-id", createdAt: new Date("2026-10-29T17:00:00Z") }),
        createMockStandup({ memberId: "bob-id", createdAt: new Date("2026-10-30T17:00:00Z") }),
        createMockStandup({ memberId: "bob-id", createdAt: new Date("2026-11-01T17:00:00Z") }),
      ];
      const bobReviews = [1, 2, 3, 4, 5].map((num) =>
        createMockPrReview({
          reviewerLogin: "bob",
          prId: `pr-b-${num}`,
          prAuthorLogin: "alice",
          submittedAt: new Date("2026-10-30T17:00:00Z"),
        })
      );

      const result = checkSprintRequirements({
        sprint,
        members: [alice, bob],
        standups: [...aliceStandups, ...bobStandups],
        prReviews: [...aliceReviews, ...bobReviews],
        now: new Date("2026-11-01T18:00:00Z"),
      });

      expect(result.allMet).toBe(true);
      expect(result.metCount).toBe(2);
      expect(result.totalMembers).toBe(2);
      expect(result.length).toBe(2);

      expect(result.byMemberId["alice-id"].isMet).toBe(true);
      expect(result.byMemberId["bob-id"].isMet).toBe(true);
    });

    it("returns allMet: false if any team member falls short of either requirement", () => {
      // Alice meets both
      const aliceStandups = [
        createMockStandup({ memberId: "alice-id", createdAt: new Date("2026-10-29T16:00:00Z") }),
        createMockStandup({ memberId: "alice-id", createdAt: new Date("2026-10-30T16:00:00Z") }),
        createMockStandup({ memberId: "alice-id", createdAt: new Date("2026-10-31T16:00:00Z") }),
      ];
      const aliceReviews = [1, 2, 3, 4, 5].map((num) =>
        createMockPrReview({
          reviewerLogin: "alice",
          prId: `pr-a-${num}`,
          prAuthorLogin: "bob",
          submittedAt: new Date("2026-10-30T16:00:00Z"),
        })
      );

      // Bob has only 1 standup and 2 PR reviews
      const bobStandups = [
        createMockStandup({ memberId: "bob-id", createdAt: new Date("2026-10-29T17:00:00Z") }),
      ];
      const bobReviews = [
        createMockPrReview({
          reviewerLogin: "bob",
          prId: "pr-b-1",
          prAuthorLogin: "alice",
          submittedAt: new Date("2026-10-30T17:00:00Z"),
        }),
      ];

      const result = checkSprintRequirements({
        sprint,
        members: [alice, bob],
        standups: [...aliceStandups, ...bobStandups],
        prReviews: [...aliceReviews, ...bobReviews],
        now: new Date("2026-10-30T18:00:00Z"),
      });

      expect(result.allMet).toBe(false);
      expect(result.metCount).toBe(1);
      expect(result.totalMembers).toBe(2);

      expect(result.byMemberId["alice-id"].isMet).toBe(true);
      expect(result.byMemberId["bob-id"].isMet).toBe(false);
      expect(result.byMemberId["bob-id"].standups.isMet).toBe(false);
      expect(result.byMemberId["bob-id"].standups.remaining).toBe(2);
      expect(result.byMemberId["bob-id"].prReviews.isMet).toBe(false);
      expect(result.byMemberId["bob-id"].prReviews.remaining).toBe(4);
    });

    it("edge case: empty sprint has 0 counts and allMet: false", () => {
      const result = checkSprintRequirements({
        sprint,
        members: [alice, bob],
        standups: [],
        prReviews: [],
        now: new Date("2026-10-30T12:00:00Z"),
      });

      expect(result.allMet).toBe(false);
      expect(result.metCount).toBe(0);
      expect(result.totalMembers).toBe(2);

      for (const m of result) {
        expect(m.standups.count).toBe(0);
        expect(m.standups.remaining).toBe(3);
        expect(m.standups.status).toBe("ON_TRACK");
        expect(m.prReviews.count).toBe(0);
        expect(m.prReviews.remaining).toBe(5);
        expect(m.prReviews.status).toBe("ON_TRACK");
        expect(m.isMet).toBe(false);
      }
    });

    it("edge case: sprint boundary at midnight counts activity exactly at start and end", () => {
      // Sprint: 2026-10-29 00:00:00.000 PDT to 2026-11-04 23:59:59.999 PST
      // In UTC: 2026-10-29T07:00:00.000Z to 2026-11-05T07:59:59.999Z

      const exactStartStandup = createMockStandup({
        memberId: "alice-id",
        createdAt: new Date("2026-10-29T07:00:00.000Z"), // exactly 00:00:00.000 local
      });
      const oneMsBeforeStartStandup = createMockStandup({
        memberId: "alice-id",
        createdAt: new Date("2026-10-29T06:59:59.999Z"), // 1 ms before
      });
      const exactEndReview = createMockPrReview({
        reviewerLogin: "alice",
        prId: "pr-end",
        prAuthorLogin: "bob",
        submittedAt: new Date("2026-11-05T07:59:59.999Z"), // exactly 23:59:59.999 local
      });
      const oneMsAfterEndReview = createMockPrReview({
        reviewerLogin: "alice",
        prId: "pr-after",
        prAuthorLogin: "bob",
        submittedAt: new Date("2026-11-05T08:00:00.000Z"), // 1 ms after
      });

      const result = checkSprintRequirements({
        sprint,
        members: [alice],
        standups: [exactStartStandup, oneMsBeforeStartStandup],
        prReviews: [exactEndReview, oneMsAfterEndReview],
        now: new Date("2026-11-01T12:00:00Z"),
      });

      const aliceResult = result.byMemberId["alice-id"];
      expect(aliceResult.standups.count).toBe(1); // only the exact start one counted
      expect(aliceResult.prReviews.count).toBe(1); // only the exact end one counted
    });

    it("edge case: handles member with no GitHub login gracefully", () => {
      const memberWithoutGithub = createMockMember({
        id: "no-gh-user",
        name: "Carol",
        githubLogin: null,
      });

      const standups = [
        createMockStandup({ memberId: "no-gh-user", createdAt: new Date("2026-10-29T16:00:00Z") }),
        createMockStandup({ memberId: "no-gh-user", createdAt: new Date("2026-10-30T16:00:00Z") }),
        createMockStandup({ memberId: "no-gh-user", createdAt: new Date("2026-10-31T16:00:00Z") }),
      ];

      const result = checkSprintRequirements({
        sprint,
        members: [memberWithoutGithub],
        standups,
        prReviews: [],
        now: new Date("2026-10-30T12:00:00Z"),
      });

      const carol = result.byMemberId["no-gh-user"];
      expect(carol.standups.count).toBe(3);
      expect(carol.standups.isMet).toBe(true);
      expect(carol.prReviews.count).toBe(0);
      expect(carol.prReviews.isMet).toBe(false);
      expect(carol.isMet).toBe(false);
    });

    it("edge case: ignores bot activity and bot accounts", () => {
      const botReviews = [
        createMockPrReview({
          reviewerLogin: "dependabot[bot]",
          prId: "pr-bot-1",
          prAuthorLogin: "bob",
          submittedAt: new Date("2026-10-30T12:00:00Z"),
        }),
      ];

      const result = checkSprintRequirements({
        sprint,
        members: [alice],
        standups: [],
        prReviews: botReviews,
        now: new Date("2026-10-30T12:00:00Z"),
      });

      expect(result.byMemberId["alice-id"].prReviews.count).toBe(0);
    });

    it("edge case: duplicate webhook deliveries do not artificially inflate counts", () => {
      // Webhook delivered the same review 3 times
      const duplicateReviews = [1, 2, 3].map(() =>
        createMockPrReview({
          id: "review-event-1",
          reviewerLogin: "alice",
          prId: "pr-shared-1",
          prAuthorLogin: "bob",
          submittedAt: new Date("2026-10-30T14:00:00Z"),
        })
      );

      // Webhook delivered multiple standups on the same day
      const duplicateStandups = [1, 2].map((id) =>
        createMockStandup({
          id: `standup-${id}`,
          memberId: "alice-id",
          createdAt: new Date("2026-10-30T14:00:00Z"),
        })
      );

      const result = checkSprintRequirements({
        sprint,
        members: [alice],
        standups: duplicateStandups,
        prReviews: duplicateReviews,
        now: new Date("2026-10-30T18:00:00Z"),
      });

      expect(result.byMemberId["alice-id"].standups.count).toBe(1);
      expect(result.byMemberId["alice-id"].prReviews.count).toBe(1);
    });

    it("supports positional argument signature", () => {
      const standups = [
        createMockStandup({ memberId: "alice-id", createdAt: new Date("2026-10-29T16:00:00Z") }),
      ];
      const prReviews = [
        createMockPrReview({
          reviewerLogin: "alice",
          prId: "pr-1",
          prAuthorLogin: "bob",
          submittedAt: new Date("2026-10-30T16:00:00Z"),
        }),
      ];

      const result = checkSprintRequirements(
        sprint,
        [alice],
        standups,
        prReviews,
        { now: new Date("2026-10-30T18:00:00Z") }
      );

      expect(result.length).toBe(1);
      expect(result[0].memberId).toBe("alice-id");
      expect(result[0].standups.count).toBe(1);
      expect(result[0].prReviews.count).toBe(1);
    });

    it("supports precomputed memberCounts", () => {
      const result = checkSprintRequirements({
        sprint,
        members: [alice, bob],
        memberCounts: {
          "alice-id": { standupCount: 3, prReviewCount: 5 },
          "bob-id": { standupCount: 2, prReviewCount: 1 },
        },
        now: new Date("2026-10-30T18:00:00Z"),
      });

      expect(result.allMet).toBe(false);
      expect(result.byMemberId["alice-id"].isMet).toBe(true);
      expect(result.byMemberId["bob-id"].isMet).toBe(false);
    });

    it("supports memberCounts passed via 3-argument signature", () => {
      const result = checkSprintRequirements(sprint, [alice, bob], {
        memberCounts: {
          "alice-id": { standups: 3, prReviews: 5 },
          "bob-id": { standups: 3, prReviews: 5 },
        },
        now: new Date("2026-10-30T18:00:00Z"),
      });

      expect(result.allMet).toBe(true);
    });

    it("behaves both as an array and as an object with convenience properties", () => {
      const result = checkSprintRequirements({
        sprint,
        members: [alice, bob],
        standups: [],
        prReviews: [],
        now: new Date("2026-10-30T12:00:00Z"),
      });

      // Array behaviors
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
      expect(result.map((m) => m.name)).toEqual(["Alice", "Bob"]);
      const iteratedNames: string[] = [];
      for (const m of result) {
        iteratedNames.push(m.name ?? "");
      }
      expect(iteratedNames).toEqual(["Alice", "Bob"]);

      // Object properties
      expect(result.allMet).toBe(false);
      expect(result.totalMembers).toBe(2);
      expect(result.metCount).toBe(0);
      expect(result.daysLeft).toBe(5);
      expect(result.isSprintEnded).toBe(false);
      expect(result.members.length).toBe(2);
      expect(result.byMemberId["alice-id"]).toBeDefined();
    });

    it("works with exported aliases checkTeamMemberRequirements and checkTeamSprintRequirements", () => {
      const res1 = checkTeamMemberRequirements({
        sprint,
        members: [alice],
        standups: [],
        prReviews: [],
      });
      const res2 = checkTeamSprintRequirements({
        sprint,
        members: [alice],
        standups: [],
        prReviews: [],
      });

      expect(res1.allMet).toBe(res2.allMet);
    });

    it("returns allMet: true when team has zero members", () => {
      const result = checkSprintRequirements({
        sprint,
        members: [],
      });

      expect(result.allMet).toBe(true);
      expect(result.totalMembers).toBe(0);
      expect(result.metCount).toBe(0);
    });
  });
});
