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

// A standup as the history lists it: `date` is the team-timezone calendar day it was filed under.
export interface StandupEntry {
  id: string;
  userId: string;
  date: string;
  yesterday: string;
  today: string;
  blockers: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function createStandupEntry(
  overrides: Partial<StandupEntry> = {}
): StandupEntry {
  const id = standupSeq++;
  return {
    id: `standup-${id}`,
    userId: "user-1",
    date: "2026-11-02",
    yesterday: "GitHub sign-in works on preview deploys (#6).",
    today: "Team creation and invite links (#7).",
    blockers: null,
    createdAt: new Date("2026-11-02T17:05:00Z"), // 9:05 AM PST
    updatedAt: new Date("2026-11-02T17:05:00Z"),
    ...overrides,
  };
}
