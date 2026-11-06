import { describe, expect, it } from "vitest";
import { getStandupDate } from "@/lib/standups/standup-date";

const LA = "America/Los_Angeles";
const SHANGHAI = "Asia/Shanghai";

describe("getStandupDate", () => {
  it("returns today's date in the team timezone as YYYY-MM-DD", () => {
    // Arrange: 9:05 AM PST on Tue, Nov 3
    const now = new Date("2026-11-03T17:05:00.000Z");

    // Act
    const date = getStandupDate({ now, timezone: LA });

    // Assert
    expect(date).toBe("2026-11-03");
  });

  it("pads the month and day with a zero", () => {
    expect(
      getStandupDate({
        now: new Date("2026-01-05T20:00:00.000Z"),
        timezone: LA,
      })
    ).toBe("2026-01-05");
  });

  describe("midnight boundary in standard time (UTC-8)", () => {
    it("files a standup 1 ms before midnight under the earlier day", () => {
      expect(
        getStandupDate({
          now: new Date("2026-11-03T07:59:59.999Z"),
          timezone: LA,
        })
      ).toBe("2026-11-02");
    });

    it("files a standup at midnight under the new day", () => {
      expect(
        getStandupDate({
          now: new Date("2026-11-03T08:00:00.000Z"),
          timezone: LA,
        })
      ).toBe("2026-11-03");
    });
  });

  describe("midnight boundary in daylight time (UTC-7)", () => {
    it("files a standup 1 ms before midnight under the earlier day", () => {
      expect(
        getStandupDate({
          now: new Date("2026-10-30T06:59:59.999Z"),
          timezone: LA,
        })
      ).toBe("2026-10-29");
    });

    it("files a standup at midnight under the new day", () => {
      expect(
        getStandupDate({
          now: new Date("2026-10-30T07:00:00.000Z"),
          timezone: LA,
        })
      ).toBe("2026-10-30");
    });
  });

  // Daylight saving ends at 2:00 AM on Sun, Nov 1, 2026, so that day lasts 25 hours.
  it.each([
    ["its first moment (00:00 PDT)", "2026-11-01T07:00:00.000Z"],
    ["the repeated 1:30 AM (PST)", "2026-11-01T09:30:00.000Z"],
    ["its last moment (23:59:59.999 PST)", "2026-11-02T07:59:59.999Z"],
  ])(
    "keeps the whole 25-hour day when daylight saving ends: %s",
    (_label, instant) => {
      expect(getStandupDate({ now: new Date(instant), timezone: LA })).toBe(
        "2026-11-01"
      );
    }
  );

  it("uses the team timezone, not UTC", () => {
    // Arrange: 8 PM PST on Nov 3 is already Nov 4 in UTC
    const now = new Date("2026-11-04T04:00:00.000Z");

    // Act
    const date = getStandupDate({ now, timezone: LA });

    // Assert
    expect(date).toBe("2026-11-03");
  });

  it("gives teams in different timezones their own date for the same instant", () => {
    // Arrange
    const now = new Date("2026-11-03T20:00:00.000Z");

    // Act
    const laDate = getStandupDate({ now, timezone: LA });
    const shanghaiDate = getStandupDate({ now, timezone: SHANGHAI });

    // Assert
    expect(laDate).toBe("2026-11-03");
    expect(shanghaiDate).toBe("2026-11-04");
  });

  describe("midnight boundary east of UTC (UTC+8)", () => {
    it("files a standup 1 ms before midnight under the earlier day", () => {
      expect(
        getStandupDate({
          now: new Date("2026-11-03T15:59:59.999Z"),
          timezone: SHANGHAI,
        })
      ).toBe("2026-11-03");
    });

    it("files a standup at midnight under the new day", () => {
      expect(
        getStandupDate({
          now: new Date("2026-11-03T16:00:00.000Z"),
          timezone: SHANGHAI,
        })
      ).toBe("2026-11-04");
    });
  });

  it("works for a team on UTC", () => {
    expect(
      getStandupDate({
        now: new Date("2026-11-03T23:59:59.999Z"),
        timezone: "UTC",
      })
    ).toBe("2026-11-03");
  });
});
