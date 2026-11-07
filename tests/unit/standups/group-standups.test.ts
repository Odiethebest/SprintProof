import { beforeEach, describe, expect, it } from "vitest";
import { groupStandupsByDay } from "@/lib/standups/group-standups";
import { createStandupEntry, resetStandupSeq } from "../../factories";

describe("groupStandupsByDay", () => {
  beforeEach(() => {
    resetStandupSeq();
  });

  it("returns no days when there are no standups", () => {
    expect(groupStandupsByDay({ standups: [] })).toEqual([]);
  });

  it("puts standups with the same date under one day", () => {
    // Arrange
    const ziqi = createStandupEntry({ userId: "ziqi", date: "2026-10-30" });
    const yunhong = createStandupEntry({
      userId: "yunhong",
      date: "2026-10-30",
    });

    // Act
    const days = groupStandupsByDay({ standups: [ziqi, yunhong] });

    // Assert
    expect(days).toHaveLength(1);
    expect(days[0].date).toBe("2026-10-30");
    expect(days[0].standups).toHaveLength(2);
  });

  it("lists days newest first", () => {
    // Arrange
    const oct29 = createStandupEntry({ date: "2026-10-29" });
    const nov2 = createStandupEntry({ date: "2026-11-02" });
    const oct30 = createStandupEntry({ date: "2026-10-30" });
    const nov1 = createStandupEntry({ date: "2026-11-01" });

    // Act
    const days = groupStandupsByDay({ standups: [oct29, nov2, oct30, nov1] });

    // Assert
    expect(days.map((day) => day.date)).toEqual([
      "2026-11-02",
      "2026-11-01",
      "2026-10-30",
      "2026-10-29",
    ]);
  });

  it("lists standups within a day newest first", () => {
    // Arrange: Ziqi posted at 9:30 AM PDT, Yunhong at 11:15 AM PDT
    const ziqi = createStandupEntry({
      userId: "ziqi",
      date: "2026-10-30",
      createdAt: new Date("2026-10-30T16:30:00.000Z"),
    });
    const yunhong = createStandupEntry({
      userId: "yunhong",
      date: "2026-10-30",
      createdAt: new Date("2026-10-30T18:15:00.000Z"),
    });

    // Act
    const [day] = groupStandupsByDay({ standups: [ziqi, yunhong] });

    // Assert
    expect(day.standups.map((standup) => standup.userId)).toEqual([
      "yunhong",
      "ziqi",
    ]);
  });

  // Counting rule: a standup's day is the team-timezone date it was filed under (AGENTS.md §1).
  it("groups by the stored date, not by the UTC date of createdAt", () => {
    // Arrange: 9 PM PST on Nov 2 is already Nov 3 in UTC
    const lateEvening = createStandupEntry({
      date: "2026-11-02",
      createdAt: new Date("2026-11-03T05:00:00.000Z"),
    });

    // Act
    const days = groupStandupsByDay({ standups: [lateEvening] });

    // Assert
    expect(days.map((day) => day.date)).toEqual(["2026-11-02"]);
  });

  it("keeps the standup objects it was given, with all their fields", () => {
    // Arrange
    const standup = createStandupEntry({ blockers: "Waiting on #107." });

    // Act
    const [day] = groupStandupsByDay({ standups: [standup] });

    // Assert
    expect(day.standups[0]).toBe(standup);
  });

  it("doesn't reorder the list it was given", () => {
    // Arrange
    const older = createStandupEntry({ date: "2026-10-29" });
    const newer = createStandupEntry({ date: "2026-10-30" });
    const standups = [older, newer];

    // Act
    groupStandupsByDay({ standups });

    // Assert
    expect(standups).toEqual([older, newer]);
  });
});
