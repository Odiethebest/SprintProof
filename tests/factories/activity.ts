import type { Activity } from "@/lib/checks/requirement-status";

let activitySeq = 1;

export function resetActivitySeq(): void {
  activitySeq = 1;
}

export function createActivity(overrides: Partial<Activity> = {}): Activity {
  const id = activitySeq++;
  return {
    id: `activity-${id}`,
    type: "REVIEW",
    actorLogin: "user1",
    prNumber: 101,
    prAuthorLogin: "someone-else",
    createdAt: new Date("2026-10-30T17:00:00Z"),
    ...overrides,
  };
}
