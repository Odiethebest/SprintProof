import { tz } from "@date-fns/tz";
import { format } from "date-fns";
import {
  attributeActivities,
  type AttributeActivitiesOptions,
} from "@/lib/stats/attribute-activities";

export const ACTIVITY_FEED_LIMIT = 20;

export interface FeedStandup {
  id: string;
  userId: string;
  today: string;
  createdAt: Date;
}

export interface BuildActivityFeedOptions extends AttributeActivitiesOptions {
  standups: FeedStandup[];
}

export type ActivityFeedItem =
  | {
      kind: "STANDUP";
      id: string;
      userId: string;
      summary: string;
      occurredAt: Date;
    }
  | {
      kind: "PR_OPENED" | "REVIEW";
      id: string;
      userId: string;
      prNumber: number | null;
      summary: string | null;
      occurredAt: Date;
    }
  | {
      kind: "COMMITS";
      id: string;
      userId: string;
      commitCount: number;
      summary: string | null;
      occurredAt: Date;
    };

interface CommitGroup {
  id: string;
  userId: string;
  shas: Set<string>;
  summary: string | null;
  occurredAt: Date;
}

// The dashboard's "Activity" list: standups, opened PRs, reviews, and commits
// grouped per member per day, newest first (AGENTS.md §2 ActivityFeed).
export function buildActivityFeed({
  standups,
  ...attributeOptions
}: BuildActivityFeedOptions): ActivityFeedItem[] {
  const items: ActivityFeedItem[] = standups.map((standup) => ({
    kind: "STANDUP",
    id: standup.id,
    userId: standup.userId,
    summary: standup.today,
    occurredAt: standup.createdAt,
  }));
  const commitGroups = new Map<string, CommitGroup>();

  for (const { userId, activity } of attributeActivities(attributeOptions)) {
    const actor = activity.actorLogin.toLowerCase();
    switch (activity.type) {
      case "PR_OPENED":
        items.push({
          kind: "PR_OPENED",
          id: activity.id,
          userId,
          prNumber: activity.prNumber,
          summary: activity.title,
          occurredAt: activity.occurredAt,
        });
        break;
      case "REVIEW":
        // Counting rule: reviews on your own PR never count (AGENTS.md §1).
        if (activity.prAuthorLogin?.toLowerCase() !== actor) {
          items.push({
            kind: "REVIEW",
            id: activity.id,
            userId,
            prNumber: activity.prNumber,
            summary: activity.title,
            occurredAt: activity.occurredAt,
          });
        }
        break;
      case "COMMIT":
        if (activity.sha !== null) {
          // Commits are grouped by the calendar day in the team timezone.
          const day = format(activity.occurredAt, "yyyy-MM-dd", {
            in: tz(attributeOptions.timeZone),
          });
          const id = `commits:${userId}:${day}`;
          const group = commitGroups.get(id) ?? {
            id,
            userId,
            shas: new Set<string>(),
            summary: activity.title,
            occurredAt: activity.occurredAt,
          };
          group.shas.add(activity.sha);
          if (activity.occurredAt > group.occurredAt) {
            group.summary = activity.title;
            group.occurredAt = activity.occurredAt;
          }
          commitGroups.set(id, group);
        }
        break;
      case "PR_MERGED":
        break;
    }
  }

  for (const group of commitGroups.values()) {
    items.push({
      kind: "COMMITS",
      id: group.id,
      userId: group.userId,
      commitCount: group.shas.size,
      summary: group.summary,
      occurredAt: group.occurredAt,
    });
  }

  return items
    .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
    .slice(0, ACTIVITY_FEED_LIMIT);
}
