import { TZDate, tz } from "@date-fns/tz";
import { differenceInCalendarDays, startOfDay } from "date-fns";

export const DEFAULT_TEAM_TIMEZONE = "America/Los_Angeles";

export interface SprintDateRange {
  startDate: string | Date;
  endDate: string | Date;
  timezone?: string | null;
  timeZone?: string | null;
}

export interface SprintBoundaries {
  start: Date;
  end: Date;
  timezone: string;
}

interface DateParts {
  year: number;
  month: number;
  day: number;
}

/**
 * Creates a TZDate instance from a Date, string, or number.
 */
export function createTZDate(
  dateInput: Date | string | number,
  timeZone: string = DEFAULT_TEAM_TIMEZONE
): TZDate {
  if (dateInput instanceof Date) {
    return new TZDate(dateInput, timeZone);
  }
  if (typeof dateInput === "string") {
    return new TZDate(dateInput, timeZone);
  }
  return new TZDate(Number(dateInput), timeZone);
}

/**
 * Extracts year, month (1-indexed), and day from a Date or date string.
 * For "YYYY-MM-DD" strings, extracts the components directly to preserve
 * the intended calendar date.
 */
export function extractDateParts(
  dateInput: Date | string,
  timeZone: string = DEFAULT_TEAM_TIMEZONE
): DateParts {
  if (typeof dateInput === "string") {
    const trimmed = dateInput.trim();
    const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return {
        year: parseInt(match[1], 10),
        month: parseInt(match[2], 10),
        day: parseInt(match[3], 10),
      };
    }
  }

  if (dateInput instanceof Date) {
    if (isNaN(dateInput.getTime())) {
      throw new Error(`Invalid date input: ${String(dateInput)}`);
    }
    const isoMatch = dateInput.toISOString().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      return {
        year: parseInt(isoMatch[1], 10),
        month: parseInt(isoMatch[2], 10),
        day: parseInt(isoMatch[3], 10),
      };
    }
  }

  const tzDate = createTZDate(dateInput, timeZone);
  if (isNaN(tzDate.getTime())) {
    throw new Error(`Invalid date input: ${String(dateInput)}`);
  }

  return {
    year: tzDate.getFullYear(),
    month: tzDate.getMonth() + 1,
    day: tzDate.getDate(),
  };
}

/**
 * Computes the exact start and end timestamps for a sprint in the team's timezone.
 *
 * Per Business Rule R1:
 * "Timestamps are stored in UTC. Sprint boundaries are computed in the team's timezone.
 * A sprint runs from 00:00 on its start date through 23:59:59.999 on its end date, inclusive."
 */
export function getSprintBoundaries(
  sprint: SprintDateRange,
  fallbackTimezone: string = DEFAULT_TEAM_TIMEZONE
): SprintBoundaries {
  const timezone = sprint.timezone ?? sprint.timeZone ?? fallbackTimezone;
  const startParts = extractDateParts(sprint.startDate, timezone);
  const endParts = extractDateParts(sprint.endDate, timezone);

  const start = new TZDate(
    startParts.year,
    startParts.month - 1,
    startParts.day,
    0,
    0,
    0,
    0,
    timezone
  );

  const end = new TZDate(
    endParts.year,
    endParts.month - 1,
    endParts.day,
    23,
    59,
    59,
    999,
    timezone
  );

  return {
    start,
    end,
    timezone,
  };
}

/**
 * Checks whether a given timestamp falls within the sprint boundaries (inclusive).
 */
export function isWithinSprint(
  dateInput: Date | string | number,
  sprint: SprintDateRange,
  fallbackTimezone: string = DEFAULT_TEAM_TIMEZONE
): boolean {
  const boundaries = getSprintBoundaries(sprint, fallbackTimezone);
  const ts = new Date(dateInput).getTime();
  if (isNaN(ts)) return false;

  return ts >= boundaries.start.getTime() && ts <= boundaries.end.getTime();
}

/**
 * Checks whether the sprint has ended relative to a reference time (`now`).
 *
 * A sprint has ended if `now > boundaries.end`.
 */
export function isSprintEnded(
  sprint: SprintDateRange,
  now: Date | string | number = new Date(),
  fallbackTimezone: string = DEFAULT_TEAM_TIMEZONE
): boolean {
  const boundaries = getSprintBoundaries(sprint, fallbackTimezone);
  const nowTs = new Date(now).getTime();
  return nowTs > boundaries.end.getTime();
}

/**
 * Computes the number of calendar days left until the end of the sprint,
 * measured in the team's timezone.
 *
 * - On the sprint end date itself: 0 days left.
 * - 1 day before the end date: 1 day left.
 * - 2 days before the end date: 2 days left.
 * - After the end date: negative.
 */
export function getCalendarDaysLeft(
  sprint: SprintDateRange,
  now: Date | string | number = new Date(),
  fallbackTimezone: string = DEFAULT_TEAM_TIMEZONE
): number {
  const timezone = sprint.timezone ?? sprint.timeZone ?? fallbackTimezone;
  const endParts = extractDateParts(sprint.endDate, timezone);
  const endDay = new TZDate(
    endParts.year,
    endParts.month - 1,
    endParts.day,
    0,
    0,
    0,
    0,
    timezone
  );

  const nowDate = new Date(now);
  const currentDay = startOfDay(createTZDate(nowDate, timezone), { in: tz(timezone) });

  return differenceInCalendarDays(endDay, currentDay);
}

/**
 * Converts a date/timestamp to a YYYY-MM-DD calendar day string in the given timezone.
 * Used for per-calendar-day standup deduplication (Rule R2).
 */
export function toCalendarDateKey(
  dateInput: Date | string | number,
  timeZone: string = DEFAULT_TEAM_TIMEZONE
): string {
  const d = createTZDate(dateInput, timeZone);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
