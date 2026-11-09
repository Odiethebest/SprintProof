import type { TeamRole } from "@/lib/auth/team-access";
import {
  computeRequirementStatus,
  type RequirementProgress,
  type Standup,
} from "@/lib/checks/requirement-status";
import {
  getDaysLeft,
  getSprintState,
  type SprintRecord,
  type SprintState,
} from "@/lib/sprints";
import type { ActivityRecord } from "./attribute-activities";
import { countMemberActivity } from "./member-activity";

export type SummarySprintInput = Pick<
  SprintRecord,
  | "id"
  | "name"
  | "startDate"
  | "endDate"
  | "standupsPerPerson"
  | "reviewsPerPerson"
>;

export interface SummaryMemberInput {
  userId: string;
  name: string | null;
  githubLogin: string | null;
  role: TeamRole;
}

export interface BuildSprintSummaryOptions {
  sprint: SummarySprintInput;
  timeZone: string;
  members: SummaryMemberInput[];
  standups: Standup[];
  activities: ActivityRecord[];
  now: Date;
}

export interface MemberSummary extends SummaryMemberInput {
  commits: number;
  pullRequests: number;
  standups: RequirementProgress;
  reviews: RequirementProgress;
}

export interface SprintSummary {
  sprint: SummarySprintInput & { state: SprintState; daysLeft: number };
  countsAsOf: Date;
  members: MemberSummary[];
}

// computeRequirementStatus() takes sprint dates as the Dates Prisma reads from
// a DATE column, midnight UTC (AGENTS.md §1 Calendar dates: the known exception).
function toDbDate(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

// One sprint's counts per member, as the dashboard shows them: facts only, in
// the members' order, no ranking (AGENTS.md §1 Product principle).
export function buildSprintSummary({
  sprint,
  timeZone,
  members,
  standups,
  activities,
  now,
}: BuildSprintSummaryOptions): SprintSummary {
  // Instructors read the summary but have no requirements of their own.
  const contributors = members.filter(({ role }) => role !== "INSTRUCTOR");
  const logins = contributors.map(({ userId, githubLogin }) => ({
    userId,
    githubLogin,
  }));
  const statuses = computeRequirementStatus({
    sprint: {
      id: sprint.id,
      startDate: toDbDate(sprint.startDate),
      endDate: toDbDate(sprint.endDate),
      timezone: timeZone,
      standupsPerPerson: sprint.standupsPerPerson,
      reviewsPerPerson: sprint.reviewsPerPerson,
    },
    members: logins,
    standups,
    activities: activities.map((activity) => ({
      id: activity.id,
      type: activity.type,
      actorLogin: activity.actorLogin,
      prNumber: activity.prNumber,
      prAuthorLogin: activity.prAuthorLogin,
      createdAt: activity.occurredAt,
    })),
    now,
  });
  const counts = countMemberActivity({
    sprint,
    timeZone,
    members: logins,
    activities,
  });

  return {
    sprint: {
      id: sprint.id,
      name: sprint.name,
      startDate: sprint.startDate,
      endDate: sprint.endDate,
      standupsPerPerson: sprint.standupsPerPerson,
      reviewsPerPerson: sprint.reviewsPerPerson,
      state: getSprintState({ sprint, now, timeZone }),
      daysLeft: getDaysLeft({ sprint, now, timeZone }),
    },
    countsAsOf: now,
    members: contributors.map((member, index) => ({
      userId: member.userId,
      name: member.name,
      githubLogin: member.githubLogin,
      role: member.role,
      commits: counts[index].commits,
      pullRequests: counts[index].pullRequests,
      standups: statuses[index].standups,
      reviews: statuses[index].reviews,
    })),
  };
}
