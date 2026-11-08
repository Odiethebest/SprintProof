import { tz } from "@date-fns/tz";
import { format } from "date-fns";
import { getSprintState, type SprintDateRange } from "./sprint-dates";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface GetDaysLeftOptions {
  sprint: Pick<SprintDateRange, "endDate">;
  now: Date;
  timeZone: string;
}

// A YYYY-MM-DD date as a whole number of days, so two dates subtract exactly.
function toDayNumber(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  return Date.UTC(year, month - 1, day) / DAY_MS;
}

// Days left = the end date minus today's date, both in the team timezone,
// plus 1 because today counts (AGENTS.md §1 Requirement status).
export function getDaysLeft({
  sprint,
  now,
  timeZone,
}: GetDaysLeftOptions): number {
  const today = format(now, "yyyy-MM-dd", { in: tz(timeZone) });
  return Math.max(0, toDayNumber(sprint.endDate) - toDayNumber(today) + 1);
}

export interface SelectableSprint extends SprintDateRange {
  id: string;
}

export type StartedSprintState = "CURRENT" | "ENDED";

export interface ListStartedSprintsOptions<T extends SelectableSprint> {
  sprints: readonly T[];
  now: Date;
  timeZone: string;
}

function findStartedSprints<T extends SelectableSprint>({
  sprints,
  now,
  timeZone,
}: ListStartedSprintsOptions<T>): Array<{
  sprint: T;
  state: StartedSprintState;
}> {
  const started: Array<{ sprint: T; state: StartedSprintState }> = [];
  for (const sprint of sprints) {
    const state = getSprintState({ sprint, now, timeZone });
    if (state !== "UPCOMING") {
      started.push({ sprint, state });
    }
  }
  return started.sort((a, b) =>
    b.sprint.startDate.localeCompare(a.sprint.startDate)
  );
}

// The sprint selector lists sprints that have started, newest first; future
// sprints aren't listed (AGENTS.md §2 Screens).
export function listStartedSprints<T extends SelectableSprint>(
  options: ListStartedSprintsOptions<T>
): Array<T & { state: StartedSprintState }> {
  return findStartedSprints(options).map(({ sprint, state }) => ({
    ...sprint,
    state,
  }));
}

export interface SelectSprintOptions<
  T extends SelectableSprint,
> extends ListStartedSprintsOptions<T> {
  requestedSprintId: string | null;
}

// The requested sprint if it has started; otherwise the newest started one,
// which is the current sprint when there is one (sprints never overlap).
export function selectSprint<T extends SelectableSprint>({
  sprints,
  requestedSprintId,
  now,
  timeZone,
}: SelectSprintOptions<T>): T | null {
  const started = findStartedSprints({ sprints, now, timeZone });
  const requested = started.find(
    ({ sprint }) => sprint.id === requestedSprintId
  );
  return (requested ?? started.at(0))?.sprint ?? null;
}
