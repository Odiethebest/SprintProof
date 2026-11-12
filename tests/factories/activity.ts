import type { Activity } from "@/lib/checks/requirement-status";
import type { ActivityRecord } from "@/lib/stats/member-activity";

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

// An activity as it's stored: `occurredAt` is when it happened on GitHub.
// Defaults to a commit on Nov 2, 10:00 AM in Los Angeles.
export function createActivityRecord(
  overrides: Partial<ActivityRecord> = {}
): ActivityRecord {
  const id = activitySeq++;
  return {
    id: `activity-${id}`,
    type: "COMMIT",
    actorLogin: "user1",
    prNumber: null,
    prAuthorLogin: null,
    sha: `sha-${id}`,
    title: "Add the dashboard page",
    reviewState: null,
    occurredAt: new Date("2026-11-02T18:00:00Z"),
    ...overrides,
  };
}
