import { StandupInput } from "@/lib/checks/types";

let standupCounter = 1;

export function createMockStandup(overrides: Partial<StandupInput> = {}): StandupInput {
  const id = overrides.id ?? `standup-${standupCounter++}`;
  return {
    id,
    memberId: overrides.memberId ?? "member-1",
    createdAt: overrides.createdAt ?? new Date("2026-10-29T17:00:00Z"),
    yesterday: overrides.yesterday ?? "Worked on backend",
    today: overrides.today ?? "Working on checks",
    blockers: overrides.blockers ?? "None",
    ...overrides,
  };
}
