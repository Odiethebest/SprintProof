import { getDayStart } from "./day-start";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface SprintDateRange {
  startDate: string;
  endDate: string;
}

export interface SprintRecord extends SprintDateRange {
  id: string;
  teamId: string;
  name: string;
  standupsPerPerson: number;
  reviewsPerPerson: number;
  createdAt: string;
  updatedAt: string;
}

export interface IsWithinSprintOptions {
  sprint: SprintDateRange;
  instant: Date;
  timeZone: string;
}

function getNextDate(date: string): string {
  return new Date(Date.parse(`${date}T00:00:00.000Z`) + DAY_MS)
    .toISOString()
    .slice(0, 10);
}

export interface GetSprintWindowOptions {
  sprint: SprintDateRange;
  timeZone: string;
}

export interface SprintWindow {
  start: Date;
  end: Date;
}

// Counting rule: a sprint runs from 00:00 on its start date through 23:59:59.999
// on its end date, in the team timezone. The end is the start of the next day
// minus 1 ms, so it stays right when a DST change skips midnight (AGENTS.md §1).
export function getSprintWindow({
  sprint,
  timeZone,
}: GetSprintWindowOptions): SprintWindow {
  const nextDayStart = getDayStart({
    date: getNextDate(sprint.endDate),
    timeZone,
  });
  return {
    start: getDayStart({ date: sprint.startDate, timeZone }),
    end: new Date(nextDayStart.getTime() - 1),
  };
}

export function isWithinSprint({
  sprint,
  instant,
  timeZone,
}: IsWithinSprintOptions): boolean {
  const { start, end } = getSprintWindow({ sprint, timeZone });
  const time = instant.getTime();
  return time >= start.getTime() && time <= end.getTime();
}

export interface GetCurrentSprintOptions<
  T extends SprintDateRange = SprintDateRange,
> {
  sprints: readonly T[];
  now: Date;
  timeZone: string;
}

export function getCurrentSprint<T extends SprintDateRange>({
  sprints,
  now,
  timeZone,
}: GetCurrentSprintOptions<T>): T | null {
  for (const sprint of sprints) {
    if (isWithinSprint({ sprint, instant: now, timeZone })) {
      return sprint;
    }
  }
  return null;
}

export type SprintState = "UPCOMING" | "CURRENT" | "ENDED";

export interface GetSprintStateOptions {
  sprint: SprintDateRange;
  now: Date;
  timeZone: string;
}

export function getSprintState({
  sprint,
  now,
  timeZone,
}: GetSprintStateOptions): SprintState {
  const { start, end } = getSprintWindow({ sprint, timeZone });
  const time = now.getTime();
  if (time < start.getTime()) {
    return "UPCOMING";
  }
  if (time > end.getTime()) {
    return "ENDED";
  }
  return "CURRENT";
}
