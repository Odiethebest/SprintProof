import { TZDate } from "@date-fns/tz";
import { describe, expect, it } from "vitest";
import {
  getCurrentSprint,
  getSprintState,
  isWithinSprint,
  type SprintDateRange,
} from "@/lib/sprints";

interface TestSprint extends SprintDateRange {
  id: string;
  name: string;
}

describe("isWithinSprint", () => {
  const timeZone = "America/Los_Angeles";
  const sprint: SprintDateRange = {
    startDate: "2026-10-29",
    endDate: "2026-11-04",
  };

  it("returns true on the first minute of the sprint at midnight in the team timezone", () => {
    // Oct 29, 2026 00:00:00 PDT
    const instant = new TZDate(2026, 9, 29, 0, 0, 0, timeZone);
    expect(isWithinSprint({ sprint, instant, timeZone })).toBe(true);
  });

  it("returns false one second before the sprint starts at midnight in the team timezone", () => {
    // Oct 28, 2026 23:59:59 PDT
    const instant = new TZDate(2026, 9, 28, 23, 59, 59, timeZone);
    expect(isWithinSprint({ sprint, instant, timeZone })).toBe(false);
  });

  it("returns false one minute before the sprint starts at midnight in the team timezone", () => {
    // Oct 28, 2026 23:59:00 PDT
    const instant = new TZDate(2026, 9, 28, 23, 59, 0, timeZone);
    expect(isWithinSprint({ sprint, instant, timeZone })).toBe(false);
  });

  it("returns true during the sprint across a daylight saving time change", () => {
    // Oct 31, 2026 12:00:00 PDT
    const instant = new TZDate(2026, 9, 31, 12, 0, 0, timeZone);
    expect(isWithinSprint({ sprint, instant, timeZone })).toBe(true);
  });

  it("returns true on the last minute of the sprint before midnight in the team timezone", () => {
    // Nov 4, 2026 23:59:00 PST (DST ended Nov 1)
    const instant = new TZDate(2026, 10, 4, 23, 59, 0, timeZone);
    expect(isWithinSprint({ sprint, instant, timeZone })).toBe(true);
  });

  it("returns true on the last second of the sprint (23:59:59.999) in the team timezone", () => {
    // Nov 4, 2026 23:59:59.999 PST
    const instant = new TZDate(2026, 10, 4, 23, 59, 59, 999, timeZone);
    expect(isWithinSprint({ sprint, instant, timeZone })).toBe(true);
  });

  it("returns false one second after the sprint ends at midnight in the team timezone", () => {
    // Nov 5, 2026 00:00:00 PST
    const instant = new TZDate(2026, 10, 5, 0, 0, 0, timeZone);
    expect(isWithinSprint({ sprint, instant, timeZone })).toBe(false);
  });

  it("returns false one minute after the sprint ends in the team timezone", () => {
    // Nov 5, 2026 00:01:00 PST
    const instant = new TZDate(2026, 10, 5, 0, 1, 0, timeZone);
    expect(isWithinSprint({ sprint, instant, timeZone })).toBe(false);
  });

  it("respects Tokyo timezone boundaries when evaluating sprint boundaries", () => {
    const tokyoTz = "Asia/Tokyo";
    // 2026-10-29 00:00:00 in Tokyo is 2026-10-28 15:00:00 UTC
    const tokyoStart = new TZDate(2026, 9, 29, 0, 0, 0, tokyoTz);

    expect(isWithinSprint({ sprint, instant: tokyoStart, timeZone: tokyoTz })).toBe(
      true
    );
    expect(
      isWithinSprint({ sprint, instant: tokyoStart, timeZone: "America/Los_Angeles" })
    ).toBe(false);
  });

  it("respects UTC timezone boundaries when evaluating sprint boundaries", () => {
    const utcTz = "UTC";
    const utcStart = new Date("2026-10-29T00:00:00.000Z");
    const utcJustBefore = new Date("2026-10-28T23:59:59.000Z");

    expect(isWithinSprint({ sprint, instant: utcStart, timeZone: utcTz })).toBe(
      true
    );
    expect(
      isWithinSprint({ sprint, instant: utcJustBefore, timeZone: utcTz })
    ).toBe(false);
  });
});

describe("getCurrentSprint", () => {
  const timeZone = "America/Los_Angeles";
  const sprint0: TestSprint = {
    id: "sprint-0",
    name: "Sprint 0",
    startDate: "2026-10-22",
    endDate: "2026-10-28",
  };
  const sprint1: TestSprint = {
    id: "sprint-1",
    name: "Sprint 1",
    startDate: "2026-10-29",
    endDate: "2026-11-04",
  };
  const sprint2: TestSprint = {
    id: "sprint-2",
    name: "Sprint 2",
    startDate: "2026-11-05",
    endDate: "2026-11-11",
  };
  const allSprints = [sprint0, sprint1, sprint2];

  it("returns null when the sprint list is empty", () => {
    const now = new TZDate(2026, 9, 30, 12, 0, 0, timeZone);
    expect(getCurrentSprint({ sprints: [], now, timeZone })).toBeNull();
  });

  it("returns null when now is before all sprints", () => {
    const now = new TZDate(2026, 9, 20, 12, 0, 0, timeZone);
    expect(getCurrentSprint({ sprints: allSprints, now, timeZone })).toBeNull();
  });

  it("returns null when now is after all sprints", () => {
    const now = new TZDate(2026, 10, 15, 12, 0, 0, timeZone);
    expect(getCurrentSprint({ sprints: allSprints, now, timeZone })).toBeNull();
  });

  it("returns null when now falls in a gap between sprints", () => {
    const gappedSprints: TestSprint[] = [
      {
        id: "s-1",
        name: "Sprint 1",
        startDate: "2026-10-01",
        endDate: "2026-10-07",
      },
      {
        id: "s-2",
        name: "Sprint 2",
        startDate: "2026-10-15",
        endDate: "2026-10-21",
      },
    ];
    // Oct 10 is in the gap
    const now = new TZDate(2026, 9, 10, 12, 0, 0, timeZone);
    expect(getCurrentSprint({ sprints: gappedSprints, now, timeZone })).toBeNull();
  });

  it("returns the active sprint when now falls within it", () => {
    const now = new TZDate(2026, 9, 30, 14, 0, 0, timeZone);
    expect(getCurrentSprint({ sprints: allSprints, now, timeZone })).toEqual(
      sprint1
    );
  });

  it("returns the active sprint at the exact start boundary of sprint 1", () => {
    const now = new TZDate(2026, 9, 29, 0, 0, 0, timeZone);
    expect(getCurrentSprint({ sprints: allSprints, now, timeZone })).toEqual(
      sprint1
    );
  });

  it("returns the active sprint at the exact end boundary of sprint 1", () => {
    const now = new TZDate(2026, 10, 4, 23, 59, 59, timeZone);
    expect(getCurrentSprint({ sprints: allSprints, now, timeZone })).toEqual(
      sprint1
    );
  });
});

describe("getSprintState", () => {
  const timeZone = "America/Los_Angeles";
  const sprint: SprintDateRange = {
    startDate: "2026-10-29",
    endDate: "2026-11-04",
  };

  it("returns UPCOMING before the sprint starts in team timezone", () => {
    const now = new TZDate(2026, 9, 28, 23, 59, 0, timeZone);
    expect(getSprintState({ sprint, now, timeZone })).toBe("UPCOMING");
  });

  it("returns CURRENT during the sprint in team timezone", () => {
    const now = new TZDate(2026, 9, 30, 12, 0, 0, timeZone);
    expect(getSprintState({ sprint, now, timeZone })).toBe("CURRENT");
  });

  it("returns ENDED after the sprint ends in team timezone", () => {
    const now = new TZDate(2026, 10, 5, 0, 1, 0, timeZone);
    expect(getSprintState({ sprint, now, timeZone })).toBe("ENDED");
  });
});
