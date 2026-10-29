import { describe, expect, it } from "vitest";
import {
  checkStandupQuota,
  countQualifyingStandups,
} from "@/lib/checks/standup-quota";
import {
  createMockMember,
  createMockSprint,
  createMockStandup,
} from "../../factories";

describe("Standup Quota Checks (Rule R2 & R5)", () => {
  const sprint = createMockSprint({
    startDate: "2026-10-29",
    endDate: "2026-11-04",
    standupsPerPerson: 3,
    timezone: "America/Los_Angeles",
  });
  const member = createMockMember({ id: "user-1", name: "Alice" });

  describe("countQualifyingStandups", () => {
    it("counts standups on distinct calendar days in the sprint timezone", () => {
      const standups = [
        createMockStandup({
          memberId: "user-1",
          createdAt: new Date("2026-10-29T16:00:00Z"), // Day 1
        }),
        createMockStandup({
          memberId: "user-1",
          createdAt: new Date("2026-10-30T16:00:00Z"), // Day 2
        }),
        createMockStandup({
          memberId: "user-1",
          createdAt: new Date("2026-10-31T16:00:00Z"), // Day 3
        }),
      ];

      const count = countQualifyingStandups("user-1", standups, sprint);
      expect(count).toBe(3);
    });

    it("deduplicates multiple standups on the same calendar day to 1 (Rule R2)", () => {
      const standups = [
        createMockStandup({
          memberId: "user-1",
          createdAt: new Date("2026-10-29T16:00:00Z"), // Day 1 morning
        }),
        createMockStandup({
          memberId: "user-1",
          createdAt: new Date("2026-10-29T23:00:00Z"), // Day 1 evening update
        }),
        createMockStandup({
          memberId: "user-1",
          createdAt: new Date("2026-10-30T17:00:00Z"), // Day 2
        }),
      ];

      const count = countQualifyingStandups("user-1", standups, sprint);
      expect(count).toBe(2);
    });

    it("ignores standups submitted outside the sprint window", () => {
      const standups = [
        createMockStandup({
          memberId: "user-1",
          createdAt: new Date("2026-10-28T23:59:59Z"), // Before sprint
        }),
        createMockStandup({
          memberId: "user-1",
          createdAt: new Date("2026-10-29T16:00:00Z"), // Inside sprint
        }),
        createMockStandup({
          memberId: "user-1",
          createdAt: new Date("2026-11-05T09:00:00Z"), // After sprint
        }),
      ];

      const count = countQualifyingStandups("user-1", standups, sprint);
      expect(count).toBe(1);
    });

    it("does not count standups belonging to another team member", () => {
      const standups = [
        createMockStandup({
          memberId: "user-2",
          createdAt: new Date("2026-10-29T16:00:00Z"),
        }),
      ];

      const count = countQualifyingStandups("user-1", standups, sprint);
      expect(count).toBe(0);
    });

    it("ignores standups without a valid timestamp", () => {
      const standups = [
        {
          id: "s-bad",
          memberId: "user-1",
        },
      ];

      const count = countQualifyingStandups("user-1", standups, sprint);
      expect(count).toBe(0);
    });

    it("correctly attributes calendar days based on team timezone, not UTC", () => {
      // Oct 29 19:00 PDT is Oct 30 02:00 UTC.
      // Oct 30 09:00 PDT is Oct 30 16:00 UTC.
      // In team timezone (PDT), these are TWO different days: Oct 29 and Oct 30.
      const standups = [
        createMockStandup({
          memberId: "user-1",
          createdAt: new Date("2026-10-30T02:00:00Z"), // Oct 29 7pm PDT
        }),
        createMockStandup({
          memberId: "user-1",
          createdAt: new Date("2026-10-30T16:00:00Z"), // Oct 30 9am PDT
        }),
      ];

      const count = countQualifyingStandups("user-1", standups, sprint);
      expect(count).toBe(2);
    });
  });

  describe("checkStandupQuota", () => {
    it("returns MET when count >= required", () => {
      const standups = [
        createMockStandup({
          memberId: "user-1",
          createdAt: new Date("2026-10-29T16:00:00Z"),
        }),
        createMockStandup({
          memberId: "user-1",
          createdAt: new Date("2026-10-30T16:00:00Z"),
        }),
        createMockStandup({
          memberId: "user-1",
          createdAt: new Date("2026-10-31T16:00:00Z"),
        }),
      ];

      const result = checkStandupQuota(member, standups, sprint, {
        now: new Date("2026-10-31T18:00:00Z"),
      });

      expect(result.status).toBe("MET");
      expect(result.isMet).toBe(true);
      expect(result.count).toBe(3);
      expect(result.target).toBe(3);
      expect(result.remaining).toBe(0);
      expect(result.message).toBe("Met");
    });

    it("returns ON_TRACK when count < required and >2 days left in sprint", () => {
      const standups = [
        createMockStandup({
          memberId: "user-1",
          createdAt: new Date("2026-10-29T16:00:00Z"),
        }),
      ];

      // On Oct 30, sprint ends Nov 4 (5 days left > 2)
      const result = checkStandupQuota(member, standups, sprint, {
        now: new Date("2026-10-30T18:00:00Z"),
      });

      expect(result.status).toBe("ON_TRACK");
      expect(result.isMet).toBe(false);
      expect(result.count).toBe(1);
      expect(result.target).toBe(3);
      expect(result.remaining).toBe(2);
      expect(result.message).toBe("2 standups to go");
    });

    it("returns AT_RISK when count < required and <=2 days left in sprint", () => {
      const standups = [
        createMockStandup({
          memberId: "user-1",
          createdAt: new Date("2026-10-29T16:00:00Z"),
        }),
      ];

      // On Nov 2, sprint ends Nov 4 (2 days left <= 2)
      const result = checkStandupQuota(member, standups, sprint, {
        now: new Date("2026-11-02T18:00:00Z"),
      });

      expect(result.status).toBe("AT_RISK");
      expect(result.isMet).toBe(false);
      expect(result.count).toBe(1);
      expect(result.remaining).toBe(2);
      expect(result.message).toBe("2 standups to go");
    });

    it("returns MISSED when count < required and sprint has ended", () => {
      const standups = [
        createMockStandup({
          memberId: "user-1",
          createdAt: new Date("2026-10-29T16:00:00Z"),
        }),
        createMockStandup({
          memberId: "user-1",
          createdAt: new Date("2026-10-30T16:00:00Z"),
        }),
      ];

      // On Nov 5, sprint ended on Nov 4 23:59:59.999
      const result = checkStandupQuota(member, standups, sprint, {
        now: new Date("2026-11-05T12:00:00Z"),
      });

      expect(result.status).toBe("MISSED");
      expect(result.isMet).toBe(false);
      expect(result.count).toBe(2);
      expect(result.remaining).toBe(1);
      expect(result.message).toBe("1 standup to go");
    });

    it("uses precomputedCount when provided directly", () => {
      const result = checkStandupQuota(member, [], sprint, {
        precomputedCount: 3,
        now: new Date("2026-10-30T12:00:00Z"),
      });

      expect(result.count).toBe(3);
      expect(result.status).toBe("MET");
      expect(result.isMet).toBe(true);
    });

    it("handles zero required standups as MET", () => {
      const sprintZero = createMockSprint({
        standupsPerPerson: 0,
      });

      const result = checkStandupQuota(member, [], sprintZero, {
        now: new Date("2026-10-30T12:00:00Z"),
      });

      expect(result.status).toBe("MET");
      expect(result.isMet).toBe(true);
      expect(result.remaining).toBe(0);
    });
  });
});
