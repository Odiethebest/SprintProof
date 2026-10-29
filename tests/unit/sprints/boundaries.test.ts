import { describe, expect, it } from "vitest";
import {
  extractDateParts,
  getCalendarDaysLeft,
  getSprintBoundaries,
  isSprintEnded,
  isWithinSprint,
  toCalendarDateKey,
} from "@/lib/sprints/boundaries";
import { createMockSprint } from "../../factories";

describe("Sprint Boundaries & Date Helpers", () => {
  const sprint = createMockSprint({
    startDate: "2026-10-29",
    endDate: "2026-11-04",
    timezone: "America/Los_Angeles",
  });

  describe("getSprintBoundaries", () => {
    it("computes inclusive boundaries from 00:00:00.000 to 23:59:59.999 in team timezone", () => {
      const boundaries = getSprintBoundaries(sprint);

      // In America/Los_Angeles:
      // Oct 29, 2026 is in PDT (UTC-7) -> 00:00 PDT = 07:00 UTC
      expect(boundaries.start.toISOString()).toBe("2026-10-29T00:00:00.000-07:00");
      // Nov 04, 2026 is in PST (UTC-8) -> 23:59:59.999 PST = 07:59:59.999 UTC Nov 5
      expect(boundaries.end.toISOString()).toBe("2026-11-04T23:59:59.999-08:00");
      expect(boundaries.timezone).toBe("America/Los_Angeles");
    });

    it("respects custom timezones such as UTC and Asia/Tokyo", () => {
      const utcSprint = createMockSprint({
        startDate: "2026-10-29",
        endDate: "2026-11-04",
        timezone: "UTC",
      });
      const utcBoundaries = getSprintBoundaries(utcSprint);
      expect(utcBoundaries.start.getTime()).toBe(
        new Date("2026-10-29T00:00:00.000Z").getTime()
      );
      expect(utcBoundaries.end.getTime()).toBe(
        new Date("2026-11-04T23:59:59.999Z").getTime()
      );

      const tokyoSprint = createMockSprint({
        startDate: "2026-10-29",
        endDate: "2026-11-04",
        timezone: "Asia/Tokyo",
      });
      const tokyoBoundaries = getSprintBoundaries(tokyoSprint);
      expect(tokyoBoundaries.start.toISOString()).toBe("2026-10-29T00:00:00.000+09:00");
      expect(tokyoBoundaries.end.toISOString()).toBe("2026-11-04T23:59:59.999+09:00");
    });

    it("handles Date objects for startDate and endDate", () => {
      const boundaries = getSprintBoundaries({
        startDate: new Date("2026-10-29T00:00:00.000Z"),
        endDate: new Date("2026-11-04T00:00:00.000Z"),
        timeZone: "America/Los_Angeles", // test timeZone alias
      });
      expect(boundaries.start.toISOString()).toBe("2026-10-29T00:00:00.000-07:00");
      expect(boundaries.end.toISOString()).toBe("2026-11-04T23:59:59.999-08:00");
    });

    it("handles number timestamps in isWithinSprint and toCalendarDateKey", () => {
      const startMs = new Date("2026-10-29T12:00:00Z").getTime();
      expect(isWithinSprint(startMs, sprint)).toBe(true);
      expect(toCalendarDateKey(startMs, "America/Los_Angeles")).toBe("2026-10-29");
    });
  });

  describe("extractDateParts", () => {
    it("extracts year, month, and day correctly from strings and dates", () => {
      expect(extractDateParts("2026-10-29", "America/Los_Angeles")).toEqual({
        year: 2026,
        month: 10,
        day: 29,
      });

      expect(extractDateParts("2026-11-04T12:00:00Z", "America/Los_Angeles")).toEqual({
        year: 2026,
        month: 11,
        day: 4,
      });
    });

    it("throws error for invalid date inputs", () => {
      expect(() => extractDateParts("not-a-date")).toThrow("Invalid date input");
    });
  });

  describe("isWithinSprint", () => {
    it("includes timestamps exactly at the start and end boundaries", () => {
      const boundaries = getSprintBoundaries(sprint);

      // Exactly at start
      expect(isWithinSprint(boundaries.start, sprint)).toBe(true);
      // Exactly at end
      expect(isWithinSprint(boundaries.end, sprint)).toBe(true);
      // Middle of sprint
      expect(isWithinSprint(new Date("2026-11-01T15:00:00Z"), sprint)).toBe(true);
    });

    it("excludes timestamps 1 ms outside the sprint window", () => {
      const boundaries = getSprintBoundaries(sprint);

      const oneMsBefore = new Date(boundaries.start.getTime() - 1);
      const oneMsAfter = new Date(boundaries.end.getTime() + 1);

      expect(isWithinSprint(oneMsBefore, sprint)).toBe(false);
      expect(isWithinSprint(oneMsAfter, sprint)).toBe(false);
    });

    it("returns false for invalid date strings", () => {
      expect(isWithinSprint("invalid-timestamp", sprint)).toBe(false);
    });
  });

  describe("isSprintEnded", () => {
    const boundaries = getSprintBoundaries(sprint);

    it("returns false while the sprint is running (even at the last millisecond)", () => {
      expect(isSprintEnded(sprint, new Date("2026-10-30T12:00:00Z"))).toBe(false);
      expect(isSprintEnded(sprint, boundaries.end)).toBe(false);
    });

    it("returns true once the sprint boundary has passed", () => {
      const oneMsAfter = new Date(boundaries.end.getTime() + 1);
      expect(isSprintEnded(sprint, oneMsAfter)).toBe(true);
      expect(isSprintEnded(sprint, new Date("2026-11-05T12:00:00Z"))).toBe(true);
    });
  });

  describe("getCalendarDaysLeft", () => {
    it("calculates remaining calendar days in the sprint timezone", () => {
      // Sprint ends Nov 4, 2026 in America/Los_Angeles
      // 2026-10-29 12:00 PDT -> 6 days left
      expect(getCalendarDaysLeft(sprint, new Date("2026-10-29T19:00:00Z"))).toBe(6);
      // 2026-11-01 12:00 PST -> 3 days left
      expect(getCalendarDaysLeft(sprint, new Date("2026-11-01T20:00:00Z"))).toBe(3);
      // 2026-11-02 12:00 PST -> 2 days left
      expect(getCalendarDaysLeft(sprint, new Date("2026-11-02T20:00:00Z"))).toBe(2);
      // 2026-11-03 12:00 PST -> 1 day left
      expect(getCalendarDaysLeft(sprint, new Date("2026-11-03T20:00:00Z"))).toBe(1);
      // 2026-11-04 12:00 PST -> 0 days left (sprint end date)
      expect(getCalendarDaysLeft(sprint, new Date("2026-11-04T20:00:00Z"))).toBe(0);
      // 2026-11-05 08:00 PST -> -1 days left
      expect(getCalendarDaysLeft(sprint, new Date("2026-11-05T16:00:00Z"))).toBe(-1);
    });
  });

  describe("toCalendarDateKey", () => {
    it("correctly localizes UTC timestamps to team timezone calendar days", () => {
      // 2026-10-30 02:00:00 UTC is 2026-10-29 19:00:00 PDT (-7)
      expect(toCalendarDateKey("2026-10-30T02:00:00Z", "America/Los_Angeles")).toBe("2026-10-29");
      // 2026-10-30 07:00:00 UTC is 2026-10-30 00:00:00 PDT (-7)
      expect(toCalendarDateKey("2026-10-30T07:00:00Z", "America/Los_Angeles")).toBe("2026-10-30");
    });
  });
});
