import { TZDate } from "@date-fns/tz";
import type { Sprint } from "@/lib/checks/requirement-status";

export function createSprint(overrides: Partial<Sprint> = {}): Sprint {
  const timezone = overrides.timezone ?? "America/Los_Angeles";
  return {
    id: "sprint-1",
    startDate: new TZDate(2026, 9, 29, timezone), // Oct 29, 2026
    endDate: new TZDate(2026, 10, 4, timezone),   // Nov 4, 2026
    timezone,
    standupsPerPerson: 3,
    reviewsPerPerson: 5,
    ...overrides,
  };
}
