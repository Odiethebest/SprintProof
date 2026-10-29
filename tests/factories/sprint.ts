import { SprintInput } from "@/lib/checks/types";

let sprintCounter = 1;

export function createMockSprint(overrides: Partial<SprintInput> = {}): SprintInput {
  const id = overrides.id ?? `sprint-${sprintCounter++}`;
  return {
    id,
    name: overrides.name ?? `Sprint ${id}`,
    startDate: overrides.startDate ?? "2026-10-29",
    endDate: overrides.endDate ?? "2026-11-04",
    standupsPerPerson: overrides.standupsPerPerson ?? 3,
    prReviewsPerPerson: overrides.prReviewsPerPerson ?? 5,
    timezone: overrides.timezone ?? "America/Los_Angeles",
    ...overrides,
  };
}
