import {
  getCalendarDaysLeft,
  getSprintBoundaries,
  isWithinSprint,
  toCalendarDateKey,
} from "../sprints/boundaries";
import {
  RequirementCheckItem,
  RequirementStatus,
  SprintInput,
  StandupInput,
  TeamMemberInput,
} from "./types";

export interface CheckStandupQuotaOptions {
  now?: Date | string | number;
  timezone?: string;
  precomputedCount?: number;
}

/**
 * Counts the qualifying standups for a team member within a sprint window.
 *
 * Per Business Rule R2:
 * "At most one standup counts per person per calendar day in the team's timezone.
 * Editing the same day's standup updates it instead of adding another."
 */
export function countQualifyingStandups(
  memberId: string,
  standups: StandupInput[],
  sprint: SprintInput,
  fallbackTimezone?: string
): number {
  const boundaries = getSprintBoundaries(sprint, fallbackTimezone);
  const distinctDays = new Set<string>();

  for (const standup of standups) {
    const sAuthorId = standup.memberId ?? standup.userId ?? standup.authorId;
    if (sAuthorId !== memberId) {
      continue;
    }

    const ts = standup.createdAt ?? standup.timestamp ?? standup.date;
    if (ts === undefined || ts === null) {
      continue;
    }

    if (!isWithinSprint(ts, sprint, boundaries.timezone)) {
      continue;
    }

    const dayKey = toCalendarDateKey(ts, boundaries.timezone);
    distinctDays.add(dayKey);
  }

  return distinctDays.size;
}

/**
 * Determines requirement status (MET, ON_TRACK, AT_RISK, MISSED) based on
 * Rule R5:
 * - MET: count >= required
 * - ON_TRACK: not met, sprint running, more than 2 days left
 * - AT_RISK: not met, sprint running, 2 or fewer days left
 * - MISSED: not met, sprint ended
 */
export function computeStandupStatus(params: {
  count: number;
  required: number;
  sprintEnd: Date;
  daysLeft: number;
  now?: Date | string | number;
}): RequirementStatus {
  const { count, required, sprintEnd, daysLeft, now = new Date() } = params;

  if (count >= required) {
    return "MET";
  }

  const nowTs = new Date(now).getTime();
  if (nowTs > sprintEnd.getTime()) {
    return "MISSED";
  }

  if (daysLeft <= 2) {
    return "AT_RISK";
  }

  return "ON_TRACK";
}

/**
 * Evaluates a member's standup requirement against the sprint rules.
 */
export function checkStandupQuota(
  member: TeamMemberInput | string,
  standups: StandupInput[],
  sprint: SprintInput,
  options: CheckStandupQuotaOptions = {}
): RequirementCheckItem {
  const memberId = typeof member === "string" ? member : (member.id ?? member.memberId ?? member.userId ?? "");
  const { now = new Date(), timezone, precomputedCount } = options;

  const boundaries = getSprintBoundaries(sprint, timezone);
  const target =
    sprint.standupsPerPerson ??
    sprint.requiredStandups ??
    sprint.standupQuota ??
    3;

  const count =
    precomputedCount !== undefined
      ? precomputedCount
      : countQualifyingStandups(memberId, standups, sprint, boundaries.timezone);

  const daysLeft = getCalendarDaysLeft(sprint, now, boundaries.timezone);
  const status = computeStandupStatus({
    count,
    required: target,
    sprintEnd: boundaries.end,
    daysLeft,
    now,
  });

  const remaining = Math.max(0, target - count);
  const isMet = count >= target;
  const message = isMet
    ? "Met"
    : `${remaining} ${remaining === 1 ? "standup" : "standups"} to go`;

  return {
    requirement: "standups",
    count,
    target,
    required: target,
    remaining,
    status,
    isMet,
    message,
  };
}
