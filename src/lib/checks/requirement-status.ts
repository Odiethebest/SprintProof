import { TZDate } from "@date-fns/tz";
import { differenceInCalendarDays, endOfDay, startOfDay } from "date-fns";

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
  createdAt: Date;
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

// Counting rule: sprint boundaries in team timezone (AGENTS.md §1, R1)
function getSprintStartBoundary(date: Date, timezone: string): TZDate {
  const dateInTz = new TZDate(date, timezone);
  if (
    date.getUTCHours() === 0 &&
    date.getUTCMinutes() === 0 &&
    date.getUTCSeconds() === 0 &&
    dateInTz.getDate() !== date.getUTCDate()
  ) {
    return startOfDay(
      new TZDate(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), timezone),
    );
  }
  return startOfDay(dateInTz);
}

// Counting rule: sprint boundaries in team timezone (AGENTS.md §1, R1)
function getSprintEndBoundary(date: Date, timezone: string): TZDate {
  const dateInTz = new TZDate(date, timezone);
  if (
    date.getUTCHours() === 0 &&
    date.getUTCMinutes() === 0 &&
    date.getUTCSeconds() === 0 &&
    dateInTz.getDate() !== date.getUTCDate()
  ) {
    return endOfDay(
      new TZDate(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), timezone),
    );
  }
  return endOfDay(dateInTz);
}

// Requirement status: MET, ON_TRACK, AT_RISK (<= 2 days left), MISSED (AGENTS.md §1, R5)
function computeRequirementProgress(
  count: number,
  required: number,
  daysLeft: number,
  isSprintEnded: boolean,
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
  options: ComputeRequirementStatusOptions,
): MemberRequirementStatus[] {
  const { sprint, members, standups, activities, now } = options;

  const sprintStart = getSprintStartBoundary(sprint.startDate, sprint.timezone);
  const sprintEnd = getSprintEndBoundary(sprint.endDate, sprint.timezone);

  const isSprintEnded = now.getTime() > sprintEnd.getTime();
  const todayInTz = startOfDay(new TZDate(now, sprint.timezone));
  const endDayInTz = startOfDay(sprintEnd);
  // Days left = sprint end date minus today's date in team timezone + 1 (AGENTS.md §1, R5)
  const daysLeft = differenceInCalendarDays(endDayInTz, todayInTz) + 1;

  const startTime = sprintStart.getTime();
  const endTime = sprintEnd.getTime();

  return members.map((member) => {
    // Counting rule: at most one standup per person per calendar day in team timezone (AGENTS.md §1, R2)
    const memberStandups = standups.filter((s) => s.userId === member.userId);
    const standupDays = new Set<string>();

    for (const standup of memberStandups) {
      const standupTime = standup.createdAt.getTime();
      if (standupTime >= startTime && standupTime <= endTime) {
        const d = new TZDate(standup.createdAt, sprint.timezone);
        const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        standupDays.add(dayKey);
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
        isSprintEnded,
      ),
      reviews: computeRequirementProgress(
        reviewCount,
        sprint.reviewsPerPerson,
        daysLeft,
        isSprintEnded,
      ),
    };
  });
}
