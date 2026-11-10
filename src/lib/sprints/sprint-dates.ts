import { TZDate } from "@date-fns/tz";
import { startOfDay } from "date-fns";

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

function parseDateParts(dateStr: string): [number, number, number] {
  const [yearStr, monthStr, dayStr] = dateStr.split("-");
  return [Number(yearStr), Number(monthStr), Number(dayStr)];
}

function getSprintStartBoundary(startDateStr: string, timeZone: string): Date {
  const [year, month, day] = parseDateParts(startDateStr);
  return startOfDay(new TZDate(year, month - 1, day, timeZone));
}

function getSprintEndBoundary(endDateStr: string, timeZone: string): Date {
  const [year, month, day] = parseDateParts(endDateStr);
  return new Date(new TZDate(year, month - 1, day + 1, timeZone).getTime() - 1);
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
// on its end date, in the team timezone (AGENTS.md §1).
export function getSprintWindow({
  sprint,
  timeZone,
}: GetSprintWindowOptions): SprintWindow {
  return {
    start: new Date(getSprintStartBoundary(sprint.startDate, timeZone)),
    end: new Date(getSprintEndBoundary(sprint.endDate, timeZone)),
  };
}

export function isWithinSprint({
  sprint,
  instant,
  timeZone,
}: IsWithinSprintOptions): boolean {
  const start = getSprintStartBoundary(sprint.startDate, timeZone);
  const end = getSprintEndBoundary(sprint.endDate, timeZone);
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
  const start = getSprintStartBoundary(sprint.startDate, timeZone);
  const end = getSprintEndBoundary(sprint.endDate, timeZone);
  const time = now.getTime();
  if (time < start.getTime()) {
    return "UPCOMING";
  }
  if (time > end.getTime()) {
    return "ENDED";
  }
  return "CURRENT";
}
