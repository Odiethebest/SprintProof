import type { Standup } from "@/lib/checks/requirement-status";

let standupSeq = 1;

export function resetStandupSeq(): void {
  standupSeq = 1;
}

export function createStandup(overrides: Partial<Standup> = {}): Standup {
  const id = standupSeq++;
  return {
    id: `standup-${id}`,
    userId: "user-1",
    createdAt: new Date("2026-10-30T17:00:00Z"),
    ...overrides,
  };
}
