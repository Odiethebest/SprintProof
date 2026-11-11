import { describe, expect, it } from "vitest";
import { computeRequirementStatus } from "@/lib/checks/requirement-status";
import { getSprintWindow } from "@/lib/sprints";
import {
  createSprint,
  createMember,
  createStandup,
  createActivity,
} from "../../factories";
import { buildSprintSummary } from "@/lib/stats/sprint-summary";
import { createTeamMember } from "../../factories/member";
import {
  HOST_TIME_ZONES,
  TEAM_TIME_ZONES,
  addDays,
  listIntlDaysNearOffsetChanges,
  withHostTimeZone,
} from "../sprints/time-zone-cases";

it("counts stored standup dates even when two days were persisted after the same midnight", () => {
  const sprint = createSprint();
  const member = createMember();
  const result = computeRequirementStatus({
    sprint,
    members: [member],
    activities: [],
    now: new Date("2026-11-05T08:00:00Z"),
    standups: [
      createStandup({ userId: member.userId, date: "2026-11-03" }),
      createStandup({ userId: member.userId, date: "2026-11-04" }),
      createStandup({ userId: member.userId, date: "2026-11-04" }),
    ],
  });
  expect(result[0].standups.count).toBe(2);
});

it("returns null requirement statuses for an upcoming summary", () => {
  const summary = buildSprintSummary({
    sprint: {
      id: "future",
      name: "Future",
      startDate: "2026-11-10",
      endDate: "2026-11-10",
      standupsPerPerson: 3,
      reviewsPerPerson: 5,
    },
    timeZone: "UTC",
    members: [createTeamMember()],
    standups: [],
    activities: [],
    now: new Date("2026-11-09T12:00:00Z"),
  });
  expect(summary.sprint.state).toBe("UPCOMING");
  expect(summary.members[0].standups.status).toBeNull();
  expect(summary.members[0].reviews.status).toBeNull();
});

// Discover transition instants from the installed Intl timezone data, not issue dates.
for (const timeZone of ["America/Santiago", "America/Nuuk"]) {
  it(`uses the actual last instant of each date around 2026 transitions in ${timeZone}`, () => {
    const dateFormat = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const offsetFormat = new Intl.DateTimeFormat("en", {
      timeZone,
      timeZoneName: "longOffset",
    });
    const offset = (time: number) =>
      offsetFormat
        .formatToParts(time)
        .find((part) => part.type === "timeZoneName")?.value;
    const day = (time: number) => dateFormat.format(time);
    const transitions: number[] = [];
    const start = Date.UTC(2026, 0, 1),
      end = Date.UTC(2027, 0, 1),
      hour = 3600000;
    for (let time = start + hour; time < end; time += hour)
      if (offset(time) !== offset(time - hour)) transitions.push(time);
    expect(transitions).toHaveLength(2);
    for (const transition of transitions) {
      for (const delta of [-24, 0, 24]) {
        const endDate = day(transition + delta * hour);
        let low = Date.parse(`${endDate}T00:00:00Z`) - 24 * hour;
        let high = low + 72 * hour;
        while (high - low > 1) {
          const middle = Math.floor((low + high) / 2);
          if (day(middle) <= endDate) low = middle;
          else high = middle;
        }
        const window = getSprintWindow({
          sprint: { startDate: endDate, endDate },
          timeZone,
        });
        expect(window.end.getTime()).toBe(high - 1);
        const member = createMember({ githubLogin: "alice" });
        const result = computeRequirementStatus({
          sprint: createSprint({
            startDate: new Date(`${endDate}T00:00:00Z`),
            endDate: new Date(`${endDate}T00:00:00Z`),
            timezone: timeZone,
          }),
          members: [member],
          standups: [],
          activities: [
            createActivity({
              actorLogin: "alice",
              createdAt: new Date(high - 1),
            }),
          ],
          now: new Date(high - 1),
        });
        expect(result[0].reviews.count).toBe(1);
        expect(result[0].standups.status).toBe("AT_RISK");
      }
    }
  });
}

const DAYS_BY_TIME_ZONE = TEAM_TIME_ZONES.map((timeZone) => ({
  timeZone,
  days: listIntlDaysNearOffsetChanges({
    timeZone,
    fromYear: 2025,
    toYear: 2027,
  }),
}));

// Sprint dates as the callers pass them: Prisma reads a DATE column as midnight UTC.
function toDbDate(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

// AGENTS.md §1 Timezone: the same inputs give the same counts and statuses on
// any machine, whatever its own time zone (#99).
describe.each(HOST_TIME_ZONES)(
  "computeRequirementStatus on a host in %s",
  (hostTimeZone) => {
    it.each(DAYS_BY_TIME_ZONE)(
      "counts reviews and standups inside the day bounds Intl reports near the 2025–2027 offset changes in $timeZone",
      ({ timeZone, days }) => {
        // Arrange: a one-day sprint, reviews just outside and on its first and
        // last instants, standups on the day before, the day and the day after
        const member = createMember({ userId: "user-1", githubLogin: "alice" });

        // Act
        const observed = withHostTimeZone(hostTimeZone, () =>
          days.map(({ date, start, nextStart }) => {
            const sprint = createSprint({
              startDate: toDbDate(date),
              endDate: toDbDate(date),
              timezone: timeZone,
              standupsPerPerson: 3,
              reviewsPerPerson: 5,
            });
            const reviewTimes = [
              start.getTime() - 1,
              start.getTime(),
              nextStart.getTime() - 1,
              nextStart.getTime(),
            ];
            const activities = reviewTimes.map((time, index) =>
              createActivity({
                actorLogin: "alice",
                prNumber: index + 1,
                prAuthorLogin: "bob",
                createdAt: new Date(time),
              })
            );
            const standups = [-1, 0, 1].map((days) =>
              createStandup({
                userId: member.userId,
                date: addDays(date, days),
              })
            );
            const statusAt = (time: number) =>
              computeRequirementStatus({
                sprint,
                members: [member],
                standups,
                activities,
                now: new Date(time),
              })[0];
            const onLastInstant = statusAt(nextStart.getTime() - 1);
            return {
              date,
              reviews: onLastInstant.reviews.count,
              standups: onLastInstant.standups.count,
              statusOnLastInstant: onLastInstant.standups.status,
              statusAfterEnd: statusAt(nextStart.getTime()).standups.status,
            };
          })
        );

        // Assert: the reviews on the first and last instants and the standup on the day
        expect(observed).toEqual(
          days.map(({ date }) => ({
            date,
            reviews: 2,
            standups: 1,
            statusOnLastInstant: "AT_RISK",
            statusAfterEnd: "MISSED",
          }))
        );
      }
    );

    it.each(DAYS_BY_TIME_ZONE)(
      "counts days left from the day starts Intl reports near the 2025–2027 offset changes in $timeZone",
      ({ timeZone, days }) => {
        // Arrange: a sprint from `date` through the day after, nothing done yet
        const member = createMember({ userId: "user-1", githubLogin: "alice" });

        // Act: just before and at the start of `date`
        const observed = withHostTimeZone(hostTimeZone, () =>
          days.map(({ date, start }) => {
            const sprint = createSprint({
              startDate: toDbDate(date),
              endDate: toDbDate(addDays(date, 1)),
              timezone: timeZone,
              standupsPerPerson: 3,
              reviewsPerPerson: 5,
            });
            return {
              date,
              statuses: [start.getTime() - 1, start.getTime()].map(
                (time) =>
                  computeRequirementStatus({
                    sprint,
                    members: [member],
                    standups: [],
                    activities: [],
                    now: new Date(time),
                  })[0].standups.status
              ),
            };
          })
        );

        // Assert: 3 days left (on track) the day before, 2 (at risk) once `date` starts
        expect(observed).toEqual(
          days.map(({ date }) => ({ date, statuses: ["ON_TRACK", "AT_RISK"] }))
        );
      }
    );
  }
);
