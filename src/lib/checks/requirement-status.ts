import { tz } from "@date-fns/tz";
import { format } from "date-fns";
import {
  getDaysLeft,
  getSprintState,
  getSprintWindow,
  type SprintDateRange,
} from "@/lib/sprints";

export type RequirementStatus = "MET" | "ON_TRACK" | "AT_RISK" | "MISSED";

export interface RequirementProgress {
  count: number;
  required: number;
  remaining: number;
  status: RequirementStatus;
}

export interface MemberRequirementStatus {
  userId: string;
  standups: RequirementProgress;
  reviews: RequirementProgress;
}

export interface Sprint {
  id: string;
  startDate: Date;
  endDate: Date;
  timezone: string;
  standupsPerPerson: number;
  reviewsPerPerson: number;
}

export interface Member {
  userId: string;
  githubLogin: string | null;
}

export interface Standup {
  id: string;
  userId: string;
  date: string;
}

export type ActivityType = "COMMIT" | "PR_OPENED" | "PR_MERGED" | "REVIEW";

export interface Activity {
  id: string;
  type: ActivityType;
  actorLogin: string;
  prNumber?: number | null;
  prAuthorLogin?: string | null;
  createdAt: Date;
}

export interface ComputeRequirementStatusOptions {
  sprint: Sprint;
  members: Member[];
  standups: Standup[];
  activities: Activity[];
  now: Date;
}

// Sprint dates come as Dates (AGENTS.md §1 Calendar dates: the known
// exception): midnight UTC as Prisma reads a DATE column, or midnight in the
// team timezone. Either way they name one calendar date.
function toCalendarDate(date: Date, timezone: string): string {
  const isUtcMidnight =
    date.getUTCHours() === 0 &&
    date.getUTCMinutes() === 0 &&
    date.getUTCSeconds() === 0;
  if (isUtcMidnight) {
    return date.toISOString().slice(0, 10);
  }
  return format(date, "yyyy-MM-dd", { in: tz(timezone) });
}

// Requirement status: MET, ON_TRACK, AT_RISK (<= 2 days left), MISSED (AGENTS.md §1, R5)
function computeRequirementProgress(
  count: number,
  required: number,
  daysLeft: number,
  isSprintEnded: boolean
): RequirementProgress {
  const remaining = Math.max(0, required - count);

  if (count >= required) {
    return { count, required, remaining, status: "MET" };
  }

  if (isSprintEnded) {
    return { count, required, remaining, status: "MISSED" };
  }

  if (daysLeft <= 2) {
    return { count, required, remaining, status: "AT_RISK" };
  }

  return { count, required, remaining, status: "ON_TRACK" };
}

export function computeRequirementStatus(
  options: ComputeRequirementStatusOptions
): MemberRequirementStatus[] {
  const { sprint, members, standups, activities, now } = options;

  const timeZone = sprint.timezone;
  const sprintDates: SprintDateRange = {
    startDate: toCalendarDate(sprint.startDate, timeZone),
    endDate: toCalendarDate(sprint.endDate, timeZone),
  };
  // Counting rule: sprint boundaries in team timezone (AGENTS.md §1, R1)
  const window = getSprintWindow({ sprint: sprintDates, timeZone });
  const isSprintEnded =
    getSprintState({ sprint: sprintDates, now, timeZone }) === "ENDED";
  // Days left = sprint end date minus today's date in team timezone + 1 (AGENTS.md §1, R5)
  const daysLeft = getDaysLeft({ sprint: sprintDates, now, timeZone });

  const startTime = window.start.getTime();
  const endTime = window.end.getTime();

  return members.map((member) => {
    // Counting rule: at most one standup per person per calendar day in team timezone (AGENTS.md §1, R2)
    const memberStandups = standups.filter((s) => s.userId === member.userId);
    const standupDays = new Set<string>();

    for (const standup of memberStandups) {
      if (
        standup.date >= sprintDates.startDate &&
        standup.date <= sprintDates.endDate
      ) {
        standupDays.add(standup.date);
      }
    }
    const standupCount = standupDays.size;

    // Counting rule: reviews on own PR never count; distinct PRs reviewed; ignore bots (AGENTS.md §1, R3, R4)
    let reviewCount = 0;
    if (member.githubLogin) {
      const reviewerLogin = member.githubLogin.toLowerCase();
      const isReviewerBot = reviewerLogin.endsWith("[bot]");

      if (!isReviewerBot) {
        const reviewedPrs = new Set<number>();

        for (const activity of activities) {
          if (activity.type !== "REVIEW") {
            continue;
          }

          const actorLogin = activity.actorLogin.toLowerCase();
          if (actorLogin.endsWith("[bot]") || actorLogin !== reviewerLogin) {
            continue;
          }

          const activityTime = activity.createdAt.getTime();
          if (activityTime < startTime || activityTime > endTime) {
            continue;
          }

          const authorLogin = activity.prAuthorLogin?.toLowerCase();
          if (!authorLogin || authorLogin === reviewerLogin) {
            continue;
          }

          if (activity.prNumber != null) {
            reviewedPrs.add(activity.prNumber);
          }
        }

        reviewCount = reviewedPrs.size;
      }
    }

    return {
      userId: member.userId,
      standups: computeRequirementProgress(
        standupCount,
        sprint.standupsPerPerson,
        daysLeft,
        isSprintEnded
      ),
      reviews: computeRequirementProgress(
        reviewCount,
        sprint.reviewsPerPerson,
        daysLeft,
        isSprintEnded
      ),
    };
  });
}
