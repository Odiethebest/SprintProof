import { expect, it } from "vitest";
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
