import {
  attributeActivities,
  type AttributeActivitiesOptions,
} from "./attribute-activities";

export type { ActivityRecord, MemberLogin } from "./attribute-activities";

export interface MemberActivityCounts {
  userId: string;
  commits: number;
  pullRequests: number;
}

// Commits and opened PRs per member in one sprint. Reviews and standups come
// from computeRequirementStatus() in lib/checks, so each is counted in one place.
export function countMemberActivity(
  options: AttributeActivitiesOptions
): MemberActivityCounts[] {
  const shas = new Map<string, Set<string>>();
  const pullRequests = new Map<string, Set<number>>();
  for (const member of options.members) {
    shas.set(member.userId, new Set());
    pullRequests.set(member.userId, new Set());
  }

  for (const { userId, activity } of attributeActivities(options)) {
    // Counting rule: commits are deduplicated by SHA (AGENTS.md §1).
    if (activity.type === "COMMIT" && activity.sha !== null) {
      shas.get(userId)?.add(activity.sha);
    }
    if (activity.type === "PR_OPENED" && activity.prNumber !== null) {
      pullRequests.get(userId)?.add(activity.prNumber);
    }
  }

  return options.members.map((member) => ({
    userId: member.userId,
    commits: shas.get(member.userId)?.size ?? 0,
    pullRequests: pullRequests.get(member.userId)?.size ?? 0,
  }));
}
