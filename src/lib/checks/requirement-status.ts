import { differenceInCalendarDays, format } from "date-fns";
import { TZDate } from "@date-fns/tz";
import type {
  Activity,
  Member,
  MemberRequirementStatus,
  RequirementProgress,
  RequirementStatus,
  RequirementStatusResult,
  Sprint,
  Standup,
} from "@/types";

export type {
  RequirementProgress,
  RequirementStatus,
  MemberRequirementStatus,
  RequirementStatusResult,
};

const DEFAULT_TIMEZONE = "America/Los_Angeles";
const DEFAULT_STANDUPS_PER_PERSON = 3;
const DEFAULT_REVIEWS_PER_PERSON = 5;

export interface ComputeRequirementStatusOptions {
  sprint: Sprint;
  members: Member[];
  standups: Standup[];
  activities: Activity[];
  now: Date;
}

function toTZDate(dateInput: Date | string | number, timezone: string): TZDate {
  if (typeof dateInput === "string") {
    return new TZDate(dateInput, timezone);
  }
  if (typeof dateInput === "number") {
    return new TZDate(dateInput, timezone);
  }
  return new TZDate(dateInput, timezone);
}

function resolveCalendarDate(
  dateInput: Date | string,
  timezone: string
): string {
  if (typeof dateInput === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
      return dateInput;
    }
    if (dateInput.endsWith("Z") && dateInput.includes("T00:00:00")) {
      return dateInput.slice(0, 10);
    }
    const tzDate = toTZDate(dateInput, timezone);
    return format(tzDate, "yyyy-MM-dd");
  }

  // Date-only objects constructed via UTC midnight
  if (
    dateInput.getUTCHours() === 0 &&
    dateInput.getUTCMinutes() === 0 &&
    dateInput.getUTCSeconds() === 0 &&
    dateInput.getUTCMilliseconds() === 0
  ) {
    return dateInput.toISOString().slice(0, 10);
  }

  const tzDate = toTZDate(dateInput, timezone);
  return format(tzDate, "yyyy-MM-dd");
}

function resolveSprintBoundaries(
  sprint: Sprint,
  timezone: string
): { sprintStart: TZDate; sprintEnd: TZDate } {
  // Counting rule: sprint boundaries computed in team timezone from 00:00 through 23:59:59.999 (AGENTS.md §1, R1)
  const startDateStr = resolveCalendarDate(sprint.startDate, timezone);
  const endDateStr = resolveCalendarDate(sprint.endDate, timezone);

  const [sYear, sMonth, sDay] = startDateStr.split("-").map(Number);
  const sprintStart = new TZDate(sYear, sMonth - 1, sDay, 0, 0, 0, 0, timezone);

  const [eYear, eMonth, eDay] = endDateStr.split("-").map(Number);
  const sprintEnd = new TZDate(
    eYear,
    eMonth - 1,
    eDay,
    23,
    59,
    59,
    999,
    timezone
  );

  return { sprintStart, sprintEnd };
}

function isBotActivity(activity: Activity): boolean {
  // Counting rule: ignore bots ending in [bot] (AGENTS.md §1, R4)
  if (activity.isBot) return true;
  const candidates = [
    activity.githubLogin,
    activity.actor,
    activity.actorLogin,
    activity.login,
    activity.user?.login,
    activity.user?.githubLogin,
  ];
  return candidates.some((name) => name?.toLowerCase().endsWith("[bot]"));
}

function isReviewActivity(activity: Activity): boolean {
  const type = String(activity.type).toUpperCase();
  return type === "REVIEW" || type === "PULL_REQUEST_REVIEW";
}

function matchesMember(
  entity: {
    memberId?: string | null;
    userId?: string | null;
    authorId?: string | null;
    actor?: string | null;
    actorLogin?: string | null;
    githubLogin?: string | null;
    login?: string | null;
    user?: {
      id?: string | null;
      login?: string | null;
      githubLogin?: string | null;
    } | null;
  },
  member: Member
): boolean {
  const memberId = member.id;
  const userId = member.userId ?? member.user?.id;

  if (entity.memberId && entity.memberId === memberId) return true;
  if (entity.userId && (entity.userId === userId || entity.userId === memberId))
    return true;
  if (
    entity.authorId &&
    (entity.authorId === memberId || entity.authorId === userId)
  )
    return true;
  if (
    entity.user?.id &&
    (entity.user.id === memberId || entity.user.id === userId)
  )
    return true;

  const memberLogins: string[] = [];
  if (member.githubLogin) memberLogins.push(member.githubLogin.toLowerCase());
  if (member.login) memberLogins.push(member.login.toLowerCase());
  if (member.user?.githubLogin)
    memberLogins.push(member.user.githubLogin.toLowerCase());
  if (member.user?.login) memberLogins.push(member.user.login.toLowerCase());

  const entityLogins: string[] = [];
  if (entity.githubLogin) entityLogins.push(entity.githubLogin.toLowerCase());
  if (entity.actor) entityLogins.push(entity.actor.toLowerCase());
  if (entity.actorLogin) entityLogins.push(entity.actorLogin.toLowerCase());
  if (entity.login) entityLogins.push(entity.login.toLowerCase());
  if (entity.user?.githubLogin)
    entityLogins.push(entity.user.githubLogin.toLowerCase());
  if (entity.user?.login) entityLogins.push(entity.user.login.toLowerCase());

  return entityLogins.some((el) => memberLogins.includes(el));
}

function isReviewOnOwnPr(activity: Activity, member: Member): boolean {
  // Counting rule: reviews on own PR never count (AGENTS.md §1, R3)
  const prAuthor =
    activity.prAuthorLogin ??
    activity.prAuthor ??
    activity.prAuthorId ??
    activity.pullRequest?.authorLogin ??
    activity.pullRequest?.authorId ??
    activity.pullRequest?.user?.login ??
    activity.pullRequest?.user?.id ??
    activity.payload?.pull_request?.user?.login;

  if (!prAuthor) return false;

  const prAuthorStr = String(prAuthor).toLowerCase();

  if (member.id && member.id.toLowerCase() === prAuthorStr) return true;
  if (member.userId && member.userId.toLowerCase() === prAuthorStr) return true;
  if (member.user?.id && member.user.id.toLowerCase() === prAuthorStr)
    return true;

  if (member.githubLogin && member.githubLogin.toLowerCase() === prAuthorStr)
    return true;
  if (member.login && member.login.toLowerCase() === prAuthorStr) return true;
  if (
    member.user?.githubLogin &&
    member.user.githubLogin.toLowerCase() === prAuthorStr
  )
    return true;
  if (member.user?.login && member.user.login.toLowerCase() === prAuthorStr)
    return true;

  return false;
}

function getPrIdentifier(activity: Activity): string {
  const prId =
    activity.prNumber ??
    activity.prId ??
    activity.pullRequest?.number ??
    activity.pullRequest?.id ??
    activity.payload?.pull_request?.number ??
    activity.id;
  return String(prId);
}

function computeRequirementProgress(
  count: number,
  required: number,
  sprintEnd: TZDate,
  nowInTz: TZDate
): RequirementProgress {
  // Counting rule: requirement status computation (AGENTS.md §1, R5)
  // MET: count >= required
  // ON_TRACK: not met, sprint still running, > 2 days left
  // AT_RISK: not met, sprint still running, <= 2 days left
  // MISSED: not met, sprint ended
  const remaining = Math.max(0, required - count);
  let status: RequirementStatus;

  if (count >= required) {
    status = "MET";
  } else if (nowInTz.getTime() > sprintEnd.getTime()) {
    status = "MISSED";
  } else {
    const daysLeft = differenceInCalendarDays(sprintEnd, nowInTz);
    if (daysLeft <= 2) {
      status = "AT_RISK";
    } else {
      status = "ON_TRACK";
    }
  }

  return {
    count,
    required,
    remaining,
    status,
  };
}

export function computeRequirementStatus(
  options: ComputeRequirementStatusOptions
): RequirementStatusResult;
export function computeRequirementStatus(
  sprint: Sprint,
  members: Member[],
  standups: Standup[],
  activities: Activity[],
  now: Date
): RequirementStatusResult;
export function computeRequirementStatus(
  sprintOrOptions: Sprint | ComputeRequirementStatusOptions,
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

  if (
    membersArg === undefined &&
    typeof sprintOrOptions === "object" &&
    sprintOrOptions !== null &&
    "sprint" in sprintOrOptions
  ) {
    const options = sprintOrOptions as ComputeRequirementStatusOptions;
    sprint = options.sprint;
    members = options.members ?? [];
    standups = options.standups ?? [];
    activities = options.activities ?? [];
    now = options.now;
  } else {
    sprint = sprintOrOptions as Sprint;
    members = membersArg ?? [];
    standups = standupsArg ?? [];
    activities = activitiesArg ?? [];
    now = nowArg!;
  }

  const timezone = sprint.timezone ?? sprint.team?.timezone ?? DEFAULT_TIMEZONE;
  const { sprintStart, sprintEnd } = resolveSprintBoundaries(sprint, timezone);
  const nowInTz = new TZDate(now, timezone);

  const requiredStandups =
    sprint.standupsPerPerson ?? DEFAULT_STANDUPS_PER_PERSON;
  const requiredReviews = sprint.reviewsPerPerson ?? DEFAULT_REVIEWS_PER_PERSON;

  const resultList: MemberRequirementStatus[] = [];
  const resultMap: Record<string, MemberRequirementStatus> = {};

  for (const member of members) {
    // 1. Standups: at most one per person per calendar day in team timezone (AGENTS.md §1, R2)
    const standupDays = new Set<string>();

    for (const standup of standups) {
      if (standup.sprintId && standup.sprintId !== sprint.id) {
        continue;
      }

      if (!matchesMember(standup, member)) {
        continue;
      }

      const rawTs = standup.createdAt ?? standup.date ?? standup.postedAt;
      if (rawTs !== undefined) {
        const tzDate = toTZDate(rawTs, timezone);
        const ts = tzDate.getTime();
        if (ts < sprintStart.getTime() || ts > sprintEnd.getTime()) {
          continue;
        }
        standupDays.add(format(tzDate, "yyyy-MM-dd"));
      } else {
        standupDays.add(standup.id ?? "default-standup");
      }
    }

    // 2. Reviews: distinct PRs reviewed, excluding own PRs and bots (AGENTS.md §1, R3, R4)
    const reviewedPrs = new Set<string>();

    for (const activity of activities) {
      if (activity.sprintId && activity.sprintId !== sprint.id) {
        continue;
      }

      if (isBotActivity(activity)) {
        continue;
      }

      if (!isReviewActivity(activity)) {
        continue;
      }

      if (!matchesMember(activity, member)) {
        continue;
      }

      if (isReviewOnOwnPr(activity, member)) {
        continue;
      }

      const rawTs = activity.createdAt ?? activity.timestamp ?? activity.date;
      if (rawTs !== undefined) {
        const tzDate = toTZDate(rawTs, timezone);
        const ts = tzDate.getTime();
        if (ts < sprintStart.getTime() || ts > sprintEnd.getTime()) {
          continue;
        }
      }

      reviewedPrs.add(getPrIdentifier(activity));
    }

    const standupsProgress = computeRequirementProgress(
      standupDays.size,
      requiredStandups,
      sprintEnd,
      nowInTz
    );

    const reviewsProgress = computeRequirementProgress(
      reviewedPrs.size,
      requiredReviews,
      sprintEnd,
      nowInTz
    );

    const memberStatus: MemberRequirementStatus = {
      memberId: member.id,
      member,
      standups: standupsProgress,
      reviews: reviewsProgress,
      prReviews: reviewsProgress,
      requirements: {
        standups: standupsProgress,
        reviews: reviewsProgress,
        prReviews: reviewsProgress,
      },
    };

    resultList.push(memberStatus);
    resultMap[member.id] = memberStatus;
  }

  const result = Object.assign(
    resultList,
    resultMap
  ) as RequirementStatusResult;
  return result;
}
