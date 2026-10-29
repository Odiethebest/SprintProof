import { TZDate } from "@date-fns/tz";
import { differenceInCalendarDays, format } from "date-fns";

export type RequirementStatus = "MET" | "ON_TRACK" | "AT_RISK" | "MISSED";

export interface Sprint {
  id?: string;
  name?: string;
  startDate: Date | string;
  endDate: Date | string;
  standupsPerPerson?: number;
  reviewsPerPerson?: number;
  timezone?: string;
}

export interface Member {
  id: string;
  userId?: string;
  githubLogin?: string;
  role?: "LEAD" | "MEMBER" | "INSTRUCTOR" | string;
}

export interface Standup {
  id?: string;
  userId?: string;
  memberId?: string;
  authorId?: string;
  githubLogin?: string;
  createdAt: Date | string;
  date?: Date | string;
  submittedAt?: Date | string;
  yesterday?: string;
  today?: string;
  blockers?: string;
}

export interface Activity {
  id?: string;
  type: string;
  userId?: string;
  memberId?: string;
  githubLogin?: string;
  actorLogin?: string;
  prNumber?: number;
  prId?: string | number;
  pullRequestNumber?: number;
  targetNumber?: number;
  prAuthorLogin?: string;
  prAuthorId?: string;
  authorLogin?: string;
  createdAt: Date | string;
  timestamp?: Date | string;
  metadata?: {
    prNumber?: number;
    pullNumber?: number;
    prAuthorLogin?: string;
    prAuthorId?: string;
    authorLogin?: string;
    [key: string]: unknown;
  };
  payload?: {
    prNumber?: number;
    prAuthorLogin?: string;
    pull_request?: {
      number?: number;
      user?: {
        login?: string;
        id?: string | number;
      };
    };
    [key: string]: unknown;
  };
}

export interface RequirementCheck {
  count: number;
  required: number;
  remaining: number;
  status: RequirementStatus;
}

export interface MemberRequirementStatus {
  memberId: string;
  userId?: string;
  member: Member;
  standups: RequirementCheck;
  reviews: RequirementCheck;
  prReviews: RequirementCheck;
  requirements: {
    standups: RequirementCheck;
    reviews: RequirementCheck;
    prReviews: RequirementCheck;
  };
}

export type RequirementStatusResult = MemberRequirementStatus[] & {
  byMemberId: Record<string, MemberRequirementStatus>;
  get: (memberId: string) => MemberRequirementStatus | undefined;
  [memberId: string]: unknown;
};

export interface ComputeRequirementStatusParams {
  sprint: Sprint;
  members: Member[];
  standups?: Standup[];
  activities?: Activity[];
  now: Date;
}

function toTZDate(dateInput: Date | string, timezone: string): TZDate {
  if (typeof dateInput === "string") {
    return new TZDate(dateInput, timezone);
  }
  return new TZDate(dateInput, timezone);
}

function parseDateComponents(dateInput: Date | string, timezone: string) {
  if (typeof dateInput === "string") {
    const isoDateMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateInput);
    if (isoDateMatch && !dateInput.includes("T")) {
      return {
        year: Number(isoDateMatch[1]),
        month: Number(isoDateMatch[2]) - 1,
        day: Number(isoDateMatch[3]),
      };
    }
  }

  const tzDate = toTZDate(dateInput, timezone);
  return {
    year: tzDate.getFullYear(),
    month: tzDate.getMonth(),
    day: tzDate.getDate(),
  };
}

function getSprintBoundaries(sprint: Sprint, timezone: string) {
  const startParts = parseDateComponents(sprint.startDate, timezone);
  const endParts = parseDateComponents(sprint.endDate, timezone);

  // Business rule R1: Sprint runs from 00:00 on start date through 23:59:59.999 on end date (inclusive)
  const sprintStart = new TZDate(
    startParts.year,
    startParts.month,
    startParts.day,
    0,
    0,
    0,
    0,
    timezone
  );

  const sprintEnd = new TZDate(
    endParts.year,
    endParts.month,
    endParts.day,
    23,
    59,
    59,
    999,
    timezone
  );

  return { sprintStart, sprintEnd };
}

function evaluateRequirementStatus(
  count: number,
  required: number,
  now: Date,
  sprintEnd: TZDate,
  timezone: string
): RequirementStatus {
  // Business rule R5:
  // - MET: count >= required
  // - ON_TRACK: not met, sprint running, more than 2 days left
  // - AT_RISK: not met, sprint running, 2 or fewer days left
  // - MISSED: not met, sprint ended
  if (count >= required) {
    return "MET";
  }

  if (now.getTime() > sprintEnd.getTime()) {
    return "MISSED";
  }

  const nowInTeamTz = toTZDate(now, timezone);
  const daysLeft = differenceInCalendarDays(sprintEnd, nowInTeamTz) + 1;

  if (daysLeft <= 2) {
    return "AT_RISK";
  }

  return "ON_TRACK";
}

function isBotLogin(login?: string): boolean {
  if (!login) {
    return false;
  }
  // Counting rule R4: Ignore bots (logins ending in [bot])
  return login.toLowerCase().endsWith("[bot]");
}

function isStandupForMember(standup: Standup, member: Member): boolean {
  if (
    standup.userId &&
    (standup.userId === member.userId || standup.userId === member.id)
  ) {
    return true;
  }
  if (standup.memberId && standup.memberId === member.id) {
    return true;
  }
  if (
    standup.authorId &&
    (standup.authorId === member.userId || standup.authorId === member.id)
  ) {
    return true;
  }
  if (
    member.githubLogin &&
    standup.githubLogin &&
    standup.githubLogin.toLowerCase() === member.githubLogin.toLowerCase()
  ) {
    return true;
  }
  return false;
}

function isReviewActivity(type: string): boolean {
  const normalized = type.toUpperCase();
  return normalized === "REVIEW" || normalized === "PULL_REQUEST_REVIEW";
}

function isActivityForMember(activity: Activity, member: Member): boolean {
  if (
    activity.userId &&
    (activity.userId === member.userId || activity.userId === member.id)
  ) {
    return true;
  }
  if (activity.memberId && activity.memberId === member.id) {
    return true;
  }

  const actor = activity.actorLogin ?? activity.githubLogin;
  if (
    member.githubLogin &&
    actor &&
    actor.toLowerCase() === member.githubLogin.toLowerCase()
  ) {
    return true;
  }

  return false;
}

function isOwnPrReview(activity: Activity, member: Member): boolean {
  // Counting rule R3: Reviews on member's own PR never count
  const authorLogin =
    activity.prAuthorLogin ??
    activity.metadata?.prAuthorLogin ??
    activity.authorLogin ??
    activity.metadata?.authorLogin ??
    activity.payload?.prAuthorLogin ??
    activity.payload?.pull_request?.user?.login;

  if (
    authorLogin &&
    member.githubLogin &&
    authorLogin.toLowerCase() === member.githubLogin.toLowerCase()
  ) {
    return true;
  }

  const authorId =
    activity.prAuthorId ??
    activity.metadata?.prAuthorId ??
    activity.payload?.pull_request?.user?.id;

  if (
    authorId &&
    (String(authorId) === String(member.userId) ||
      String(authorId) === String(member.id))
  ) {
    return true;
  }

  return false;
}

function getPrIdentifier(activity: Activity): string {
  const prNum =
    activity.prNumber ??
    activity.metadata?.prNumber ??
    activity.metadata?.pullNumber ??
    activity.payload?.prNumber ??
    activity.payload?.pull_request?.number ??
    activity.prId ??
    activity.pullRequestNumber ??
    activity.targetNumber ??
    activity.id;

  return String(prNum ?? "unknown");
}

export function computeRequirementStatus(
  sprintOrParams: Sprint | ComputeRequirementStatusParams,
  membersArg?: Member[],
  standupsArg?: Standup[],
  activitiesArg?: Activity[],
  nowArg?: Date
): RequirementStatusResult {
  let sprint: Sprint;
  let members: Member[];
  let standups: Standup[];
  let activities: Activity[];
  let now: Date;

  if ("sprint" in sprintOrParams && "now" in sprintOrParams) {
    const params = sprintOrParams as ComputeRequirementStatusParams;
    sprint = params.sprint;
    members = params.members ?? [];
    standups = params.standups ?? [];
    activities = params.activities ?? [];
    now = params.now;
  } else {
    sprint = sprintOrParams as Sprint;
    members = membersArg ?? [];
    standups = standupsArg ?? [];
    activities = activitiesArg ?? [];
    now = nowArg!;
  }

  const timezone = sprint.timezone ?? "America/Los_Angeles";
  const { sprintStart, sprintEnd } = getSprintBoundaries(sprint, timezone);

  const standupsRequired = sprint.standupsPerPerson ?? 3;
  const reviewsRequired = sprint.reviewsPerPerson ?? 5;

  const results = [] as unknown as RequirementStatusResult;
  const byMemberId: Record<string, MemberRequirementStatus> = {};

  for (const member of members) {
    // 1. Standups: at most one per member per calendar day in team timezone (R2)
    const distinctStandupDays = new Set<string>();

    for (const standup of standups) {
      if (!isStandupForMember(standup, member)) {
        continue;
      }

      const timestamp =
        standup.createdAt ?? standup.date ?? standup.submittedAt;
      if (!timestamp) {
        continue;
      }

      const tzDate = toTZDate(timestamp, timezone);
      const timeMs = tzDate.getTime();

      // Check sprint boundary [00:00:00.000, 23:59:59.999]
      if (timeMs >= sprintStart.getTime() && timeMs <= sprintEnd.getTime()) {
        const dayKey = format(tzDate, "yyyy-MM-dd");
        distinctStandupDays.add(dayKey);
      }
    }

    const standupsCount = distinctStandupDays.size;
    const standupsRemaining = Math.max(0, standupsRequired - standupsCount);
    const standupsStatus = evaluateRequirementStatus(
      standupsCount,
      standupsRequired,
      now,
      sprintEnd,
      timezone
    );

    // 2. Reviews: distinct PRs reviewed, only on PRs authored by someone else (R3), ignore bots (R4)
    const distinctReviewedPrs = new Set<string>();

    for (const activity of activities) {
      const actorLogin = activity.actorLogin ?? activity.githubLogin;

      // Ignore bot activities (R4)
      if (isBotLogin(actorLogin)) {
        continue;
      }

      if (!isReviewActivity(activity.type)) {
        continue;
      }

      if (!isActivityForMember(activity, member)) {
        continue;
      }

      const timestamp = activity.createdAt ?? activity.timestamp;
      if (!timestamp) {
        continue;
      }

      const tzDate = toTZDate(timestamp, timezone);
      const timeMs = tzDate.getTime();

      // Check sprint boundary
      if (timeMs < sprintStart.getTime() || timeMs > sprintEnd.getTime()) {
        continue;
      }

      // Reviews on own PR never count (R3)
      if (isOwnPrReview(activity, member)) {
        continue;
      }

      const prIdentifier = getPrIdentifier(activity);
      distinctReviewedPrs.add(prIdentifier);
    }

    const reviewsCount = distinctReviewedPrs.size;
    const reviewsRemaining = Math.max(0, reviewsRequired - reviewsCount);
    const reviewsStatus = evaluateRequirementStatus(
      reviewsCount,
      reviewsRequired,
      now,
      sprintEnd,
      timezone
    );

    const standupCheck: RequirementCheck = {
      count: standupsCount,
      required: standupsRequired,
      remaining: standupsRemaining,
      status: standupsStatus,
    };

    const reviewCheck: RequirementCheck = {
      count: reviewsCount,
      required: reviewsRequired,
      remaining: reviewsRemaining,
      status: reviewsStatus,
    };

    const memberStatus: MemberRequirementStatus = {
      memberId: member.id,
      userId: member.userId,
      member,
      standups: standupCheck,
      reviews: reviewCheck,
      prReviews: reviewCheck,
      requirements: {
        standups: standupCheck,
        reviews: reviewCheck,
        prReviews: reviewCheck,
      },
    };

    results.push(memberStatus);
    byMemberId[member.id] = memberStatus;
    (results as Record<string, unknown>)[member.id] = memberStatus;
  }

  results.byMemberId = byMemberId;
  results.get = (memberId: string) => byMemberId[memberId];

  return results;
}
