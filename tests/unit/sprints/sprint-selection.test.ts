import { TZDate } from "@date-fns/tz";
import { describe, expect, it } from "vitest";
import {
  getDaysLeft,
  getSprintWindow,
  listStartedSprints,
  selectSprint,
  type SprintDateRange,
} from "@/lib/sprints";

interface TestSprint extends SprintDateRange {
  id: string;
  name: string;
}

const timeZone = "America/Los_Angeles";

const SPRINT_1: TestSprint = {
  id: "sprint-1",
  name: "Sprint 1",
  startDate: "2026-10-29",
  endDate: "2026-11-04",
};
const SPRINT_2: TestSprint = {
  id: "sprint-2",
  name: "Sprint 2",
  startDate: "2026-11-05",
  endDate: "2026-11-11",
};
const SPRINT_3: TestSprint = {
  id: "sprint-3",
  name: "Sprint 3",
  startDate: "2026-11-12",
  endDate: "2026-11-18",
};

describe("getSprintWindow", () => {
  it("runs from midnight on the start date to the last millisecond of the end date in the team timezone", () => {
    // Act
    const window = getSprintWindow({ sprint: SPRINT_1, timeZone });

    // Assert: Oct 29 is PDT (UTC-7); Nov 4 is PST (UTC-8) after the Nov 1 DST change
    expect(window).toEqual({
      start: new Date("2026-10-29T07:00:00.000Z"),
      end: new Date("2026-11-05T07:59:59.999Z"),
    });
  });

  it("uses the given timezone, not UTC", () => {
    // Act
    const window = getSprintWindow({ sprint: SPRINT_1, timeZone: "UTC" });

    // Assert
    expect(window).toEqual({
      start: new Date("2026-10-29T00:00:00.000Z"),
      end: new Date("2026-11-04T23:59:59.999Z"),
    });
  });
});

describe("getDaysLeft", () => {
  it("counts today, so Nov 2 has 3 days left in a sprint ending Nov 4", () => {
    const now = new TZDate(2026, 10, 2, 10, 0, timeZone);
    expect(getDaysLeft({ sprint: SPRINT_1, now, timeZone })).toBe(3);
  });

  it("has 2 days left on Nov 3", () => {
    const now = new TZDate(2026, 10, 3, 10, 0, timeZone);
    expect(getDaysLeft({ sprint: SPRINT_1, now, timeZone })).toBe(2);
  });

  it("has 1 day left on the end date, up to its last minute", () => {
    const now = new TZDate(2026, 10, 4, 23, 59, 59, timeZone);
    expect(getDaysLeft({ sprint: SPRINT_1, now, timeZone })).toBe(1);
  });

  it("uses today's date in the team timezone, not in UTC", () => {
    // Nov 4 07:30 UTC is still Nov 3, 11:30 PM in Los Angeles
    const now = new Date("2026-11-04T07:30:00.000Z");
    expect(getDaysLeft({ sprint: SPRINT_1, now, timeZone })).toBe(2);
  });

  it("has the whole sprint left on the first day", () => {
    const now = new TZDate(2026, 9, 29, 0, 0, timeZone);
    expect(getDaysLeft({ sprint: SPRINT_1, now, timeZone })).toBe(7);
  });

  it("has 0 days left once the sprint has ended", () => {
    const now = new TZDate(2026, 10, 5, 0, 0, timeZone);
    expect(getDaysLeft({ sprint: SPRINT_1, now, timeZone })).toBe(0);
  });

  it("never goes below 0 long after the sprint", () => {
    const now = new TZDate(2026, 11, 25, 12, 0, timeZone);
    expect(getDaysLeft({ sprint: SPRINT_1, now, timeZone })).toBe(0);
  });
});

describe("listStartedSprints", () => {
  it("lists sprints that have started, newest first, with their state", () => {
    // Arrange: Nov 7 is inside Sprint 2
    const now = new TZDate(2026, 10, 7, 12, 0, timeZone);

    // Act
    const options = listStartedSprints({
      sprints: [SPRINT_1, SPRINT_2, SPRINT_3],
      now,
      timeZone,
    });

    // Assert: Sprint 3 hasn't started, so it isn't listed
    expect(options).toEqual([
      { ...SPRINT_2, state: "CURRENT" },
      { ...SPRINT_1, state: "ENDED" },
    ]);
  });

  it("sorts by start date when the sprints come in another order", () => {
    const now = new TZDate(2026, 10, 7, 12, 0, timeZone);

    const options = listStartedSprints({
      sprints: [SPRINT_2, SPRINT_3, SPRINT_1],
      now,
      timeZone,
    });

    expect(options.map((sprint) => sprint.id)).toEqual([
      "sprint-2",
      "sprint-1",
    ]);
  });

  it("starts a sprint at midnight in the team timezone", () => {
    // Nov 5 00:00 in Los Angeles is Nov 5 08:00 UTC
    const justBefore = new Date("2026-11-05T07:59:59.999Z");
    const atMidnight = new Date("2026-11-05T08:00:00.000Z");

    const before = listStartedSprints({
      sprints: [SPRINT_1, SPRINT_2],
      now: justBefore,
      timeZone,
    });
    const after = listStartedSprints({
      sprints: [SPRINT_1, SPRINT_2],
      now: atMidnight,
      timeZone,
    });

    expect(before.map((sprint) => sprint.id)).toEqual(["sprint-1"]);
    expect(after.map((sprint) => sprint.id)).toEqual(["sprint-2", "sprint-1"]);
  });

  it("returns an empty list when no sprint has started", () => {
    const now = new TZDate(2026, 10, 7, 12, 0, timeZone);

    const options = listStartedSprints({
      sprints: [SPRINT_3],
      now,
      timeZone,
    });

    expect(options).toEqual([]);
  });
});

describe("selectSprint", () => {
  const now = new TZDate(2026, 10, 7, 12, 0, timeZone); // inside Sprint 2

  it("returns the requested sprint when it has started", () => {
    const sprint = selectSprint({
      sprints: [SPRINT_1, SPRINT_2, SPRINT_3],
      requestedSprintId: "sprint-1",
      now,
      timeZone,
    });

    expect(sprint).toEqual(SPRINT_1);
  });

  it("returns the current sprint when none is requested", () => {
    const sprint = selectSprint({
      sprints: [SPRINT_1, SPRINT_2, SPRINT_3],
      requestedSprintId: null,
      now,
      timeZone,
    });

    expect(sprint).toEqual(SPRINT_2);
  });

  it("ignores a requested sprint that hasn't started", () => {
    const sprint = selectSprint({
      sprints: [SPRINT_1, SPRINT_2, SPRINT_3],
      requestedSprintId: "sprint-3",
      now,
      timeZone,
    });

    expect(sprint).toEqual(SPRINT_2);
  });

  it("ignores a requested id that isn't one of the team's sprints", () => {
    const sprint = selectSprint({
      sprints: [SPRINT_1, SPRINT_2],
      requestedSprintId: "another-teams-sprint",
      now,
      timeZone,
    });

    expect(sprint).toEqual(SPRINT_2);
  });

  it("returns the latest ended sprint when today falls between sprints", () => {
    // Nov 7 with only Sprint 1 (ended) and Sprint 3 (upcoming)
    const sprint = selectSprint({
      sprints: [SPRINT_1, SPRINT_3],
      requestedSprintId: null,
      now,
      timeZone,
    });

    expect(sprint).toEqual(SPRINT_1);
  });

  it("returns null when no sprint has started", () => {
    const sprint = selectSprint({
      sprints: [SPRINT_3],
      requestedSprintId: null,
      now,
      timeZone,
    });

    expect(sprint).toBeNull();
  });

  it("returns null when the team has no sprints", () => {
    const sprint = selectSprint({
      sprints: [],
      requestedSprintId: null,
      now,
      timeZone,
    });

    expect(sprint).toBeNull();
  });
});
