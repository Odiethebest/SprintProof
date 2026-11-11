import { describe, expect, it } from "vitest";
import {
  getDaysLeft,
  getSprintState,
  getSprintWindow,
  isWithinSprint,
} from "@/lib/sprints";
import {
  HOST_TIME_ZONES,
  TEAM_TIME_ZONES,
  addDays,
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

// AGENTS.md §1 Timezone: the same sprint dates give the same window on any
// machine, whatever its own time zone (#99).
describe.each(HOST_TIME_ZONES)(
  "sprint windows on a host in %s",
  (hostTimeZone) => {
    function oneDayWindow(date: string, timeZone: string) {
      return withHostTimeZone(hostTimeZone, () =>
        getSprintWindow({
          sprint: { startDate: date, endDate: date },
          timeZone,
        })
      );
    }

    it("ends the day before a spring-forward change at its last instant", () => {
      // Nuuk's clocks go from 23:00 on Mar 28 (UTC-2) to 00:00 on Mar 29
      // (UTC-1), so Mar 28 ends at 22:59:59.999 local time
      expect(oneDayWindow("2026-03-28", "America/Nuuk")).toEqual({
        start: new Date("2026-03-28T02:00:00.000Z"),
        end: new Date("2026-03-29T00:59:59.999Z"),
      });
    });

    it("ends the day before a fall-back change after its repeated hour", () => {
      // Nuuk's clocks go back from 00:00 on Oct 25 (UTC-1) to 23:00 on Oct 24 (UTC-2)
      expect(oneDayWindow("2026-10-24", "America/Nuuk")).toEqual({
        start: new Date("2026-10-24T01:00:00.000Z"),
        end: new Date("2026-10-25T01:59:59.999Z"),
      });
    });

    it("starts a sprint on a day whose midnight is skipped at the first instant that exists", () => {
      // Havana's clocks go from 00:00 on Mar 8 straight to 01:00 (UTC-4)
      expect(oneDayWindow("2026-03-08", "America/Havana")).toEqual({
        start: new Date("2026-03-08T05:00:00.000Z"),
        end: new Date("2026-03-09T03:59:59.999Z"),
      });
    });

    it("starts a sprint on a day whose midnight is repeated at the first 00:00", () => {
      // Havana's clocks go back from 01:00 on Nov 1 (UTC-4) to 00:00 (UTC-5)
      expect(oneDayWindow("2026-11-01", "America/Havana")).toEqual({
        start: new Date("2026-11-01T04:00:00.000Z"),
        end: new Date("2026-11-02T04:59:59.999Z"),
      });
    });

    it.each(DAYS_BY_TIME_ZONE)(
      "bounds one-day sprints near the 2025–2027 offset changes in $timeZone by the day starts Intl reports",
      ({ timeZone, days }) => {
        // Act: each sprint is one day; check its window and the instants around it
        const observed = withHostTimeZone(hostTimeZone, () =>
          days.map(({ date, start, nextStart }) => {
            const sprint = { startDate: date, endDate: date };
            const window = getSprintWindow({ sprint, timeZone });
            const instants = [
              start.getTime() - 1,
              start.getTime(),
              nextStart.getTime() - 1,
              nextStart.getTime(),
            ].map((time) => new Date(time));
            return {
              date,
              start: window.start.toISOString(),
              end: window.end.toISOString(),
              isWithinSprint: instants.map((instant) =>
                isWithinSprint({ sprint, instant, timeZone })
              ),
              state: instants.map((now) =>
                getSprintState({ sprint, now, timeZone })
              ),
            };
          })
        );

        // Assert: 00:00 on the date through the instant before the next day starts
        expect(observed).toEqual(
          days.map(({ date, start, nextStart }) => ({
            date,
            start: start.toISOString(),
            end: new Date(nextStart.getTime() - 1).toISOString(),
            isWithinSprint: [false, true, true, false],
            state: ["UPCOMING", "CURRENT", "CURRENT", "ENDED"],
          }))
        );
      }
    );

    it.each(DAYS_BY_TIME_ZONE)(
      "counts days left from the day starts Intl reports near the 2025–2027 offset changes in $timeZone",
      ({ timeZone, days }) => {
        // Act: a sprint that ends the day after `date`, just before and at the start of `date`
        const observed = withHostTimeZone(hostTimeZone, () =>
          days.map(({ date, start }) => ({
            date,
            daysLeft: [start.getTime() - 1, start.getTime()].map((time) =>
              getDaysLeft({
                sprint: { endDate: addDays(date, 1) },
                now: new Date(time),
                timeZone,
              })
            ),
          }))
        );

        // Assert: 3 days left on the day before, 2 once `date` starts
        expect(observed).toEqual(
          days.map(({ date }) => ({ date, daysLeft: [3, 2] }))
        );
      }
    );
  }
);
