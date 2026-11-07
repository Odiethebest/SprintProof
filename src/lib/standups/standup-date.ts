import { tz } from "@date-fns/tz";
import { format } from "date-fns";

export interface GetStandupDateOptions {
  now: Date;
  timezone: string;
}

// Counting rule: at most one standup per person per calendar day in the team timezone (AGENTS.md §1).
export function getStandupDate({
  now,
  timezone,
}: GetStandupDateOptions): string {
  return format(now, "yyyy-MM-dd", { in: tz(timezone) });
}
