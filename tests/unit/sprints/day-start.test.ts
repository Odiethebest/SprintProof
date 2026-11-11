import { describe, expect, it } from "vitest";
import { getDayStart } from "@/lib/sprints/day-start";
import {
  HOST_TIME_ZONES,
  TEAM_TIME_ZONES,
  listIntlDaysNearOffsetChanges,
  withHostTimeZone,
} from "./time-zone-cases";

const DAYS_BY_TIME_ZONE = TEAM_TIME_ZONES.map((timeZone) => ({
  timeZone,
  days: listIntlDaysNearOffsetChanges({
    timeZone,
    fromYear: 2025,
    toYear: 2027,
  }),
}));

describe.each(HOST_TIME_ZONES)(
  "getDayStart on a host in %s",
  (hostTimeZone) => {
    function dayStart(date: string, timeZone: string): string {
      return withHostTimeZone(hostTimeZone, () =>
        getDayStart({ date, timeZone })
      ).toISOString();
    }

    it("returns 00:00 on the date in the team timezone", () => {
      expect(dayStart("2026-10-29", "America/Los_Angeles")).toBe(
        "2026-10-29T07:00:00.000Z"
      );
      // Los Angeles is UTC-8 after the Nov 1 change
      expect(dayStart("2026-11-04", "America/Los_Angeles")).toBe(
        "2026-11-04T08:00:00.000Z"
      );
      expect(dayStart("2026-10-25", "Europe/London")).toBe(
        "2026-10-24T23:00:00.000Z"
      );
    });

    it("returns 00:00 in zones with half-hour offsets", () => {
      expect(dayStart("2026-03-21", "Asia/Tehran")).toBe(
        "2026-03-20T20:30:00.000Z"
      );
      expect(dayStart("2026-10-04", "Australia/Lord_Howe")).toBe(
        "2026-10-03T13:30:00.000Z"
      );
    });

    it("starts a day whose midnight a DST change skips at the first instant that exists", () => {
      // Havana's clocks go from 00:00 straight to 01:00 (UTC-4)
      expect(dayStart("2026-03-08", "America/Havana")).toBe(
        "2026-03-08T05:00:00.000Z"
      );
      // Santiago's go from 00:00 to 01:00 (UTC-3)
      expect(dayStart("2026-09-06", "America/Santiago")).toBe(
        "2026-09-06T04:00:00.000Z"
      );
      // Cairo's go from 00:00 to 01:00 (UTC+3)
      expect(dayStart("2026-04-24", "Africa/Cairo")).toBe(
        "2026-04-23T22:00:00.000Z"
      );
      // In 2022, Tehran's last year of DST, its clocks went from 00:00 to 01:00 (UTC+4:30)
      expect(dayStart("2022-03-22", "Asia/Tehran")).toBe(
        "2022-03-21T20:30:00.000Z"
      );
    });

    it("starts a day whose midnight a DST change repeats at the first 00:00", () => {
      // Havana's clocks go back from 01:00 (UTC-4) to 00:00 (UTC-5), so 00:00 comes twice
      expect(dayStart("2026-11-01", "America/Havana")).toBe(
        "2026-11-01T04:00:00.000Z"
      );
    });

    it.each(DAYS_BY_TIME_ZONE)(
      "returns the day start Intl reports for each day near the 2025–2027 offset changes in $timeZone",
      ({ timeZone, days }) => {
        // Act
        const starts = withHostTimeZone(hostTimeZone, () =>
          days.map(({ date }) => ({
            date,
            start: getDayStart({ date, timeZone }).toISOString(),
          }))
        );

        // Assert
        expect(starts).toEqual(
          days.map(({ date, start }) => ({ date, start: start.toISOString() }))
        );
      }
    );
  }
);
