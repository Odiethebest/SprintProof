import {
  getCalendarDaysLeft,
  getSprintBoundaries,
  isSprintEnded,
} from "../sprints/boundaries";
import { checkPrReviewQuota } from "./pr-review-quota";
import { checkStandupQuota } from "./standup-quota";
import {
  CheckSprintRequirementsInput,
  CheckSprintRequirementsOptions,
  MemberRequirementCheck,
  PrReviewInput,
  RequirementStatus,
  SprintInput,
  StandupInput,
  TeamMemberInput,
  TeamRequirementCheckResult,
} from "./types";

export interface CheckMemberRequirementsOptions {
  sprint: SprintInput;
  standups?: StandupInput[];
  prReviews?: PrReviewInput[];
  standupCount?: number;
  prReviewCount?: number;
  now?: Date | string | number;
  timezone?: string;
}

/**
 * Derives overall requirement status for a member from their standup and PR review statuses.
 */
function deriveOverallStatus(
  isMet: boolean,
  standupStatus: RequirementStatus,
  prReviewStatus: RequirementStatus
): RequirementStatus {
  if (isMet) {
    return "MET";
  }
  if (standupStatus === "MISSED" || prReviewStatus === "MISSED") {
    return "MISSED";
  }
  if (standupStatus === "AT_RISK" || prReviewStatus === "AT_RISK") {
    return "AT_RISK";
  }
  return "ON_TRACK";
}

/**
 * Checks whether a single team member met the sprint's standup and PR review requirements.
 */
export function checkMemberRequirements(
  member: TeamMemberInput,
  options: CheckMemberRequirementsOptions
): MemberRequirementCheck {
  const {
    sprint,
    standups = [],
    prReviews = [],
    standupCount,
    prReviewCount,
    now = new Date(),
    timezone,
  } = options;

  const memberId =
    member.id ?? member.memberId ?? member.userId ?? "";
  const name = member.name ?? member.memberName ?? memberId;
  const githubLogin = member.githubLogin ?? null;

  const standupCheck = checkStandupQuota(member, standups, sprint, {
    now,
    timezone,
    precomputedCount: standupCount,
  });

  const prReviewCheck = checkPrReviewQuota(member, prReviews, sprint, {
    now,
    timezone,
    precomputedCount: prReviewCount,
  });

  const isMet = standupCheck.isMet && prReviewCheck.isMet;
  const status = deriveOverallStatus(
    isMet,
    standupCheck.status,
    prReviewCheck.status
  );

  return {
    memberId,
    name,
    memberName: name,
    githubLogin,
    standups: standupCheck,
    prReviews: prReviewCheck,
    isMet,
    status,
  };
}

/**
 * Normalizes overloaded arguments for checkSprintRequirements.
 */
function normalizeCheckSprintInput(
  arg1: CheckSprintRequirementsInput | SprintInput,
  arg2?: TeamMemberInput[],
  arg3?: CheckSprintRequirementsOptions | StandupInput[],
  arg4?: PrReviewInput[],
  arg5?: { now?: Date | string | number; timezone?: string }
): CheckSprintRequirementsInput {
  // If first argument is CheckSprintRequirementsInput
  if ("sprint" in arg1 && "members" in arg1) {
    return arg1 as CheckSprintRequirementsInput;
  }

  const sprint = arg1 as SprintInput;
  const members = (arg2 ?? []) as TeamMemberInput[];

  // If arg3 is an array of StandupInput
  if (Array.isArray(arg3)) {
    const standups = arg3 as StandupInput[];
    const prReviews = (arg4 ?? []) as PrReviewInput[];
    const options = arg5 ?? {};
    return {
      sprint,
      members,
      standups,
      prReviews,
      now: options.now,
      timezone: options.timezone,
    };
  }

  // Otherwise arg3 is CheckSprintRequirementsOptions
  const options = (arg3 ?? {}) as CheckSprintRequirementsOptions;
  return {
    sprint,
    members,
    standups: options.standups,
    prReviews: options.prReviews,
    memberCounts: options.memberCounts,
    now: options.now,
    timezone: options.timezone,
  };
}

/**
 * Checks whether each team member met the sprint's standup and PR review requirements.
 *
 * Supports flexible calling conventions:
 * 1. Single configuration object:
 *    `checkSprintRequirements({ sprint, members, standups, prReviews, now })`
 * 2. Positional with options object:
 *    `checkSprintRequirements(sprint, members, { standups, prReviews, now })`
 * 3. Positional with raw arrays:
 *    `checkSprintRequirements(sprint, members, standups, prReviews, { now })`
 *
 * Returns a TeamRequirementCheckResult that acts both as an array of MemberRequirementCheck
 * and an object with `.allMet`, `.members`, `.byMemberId`, `.metCount`, `.totalMembers`, etc.
 */
export function checkSprintRequirements(
  input: CheckSprintRequirementsInput
): TeamRequirementCheckResult;
export function checkSprintRequirements(
  sprint: SprintInput,
  members: TeamMemberInput[],
  options?: CheckSprintRequirementsOptions
): TeamRequirementCheckResult;
export function checkSprintRequirements(
  sprint: SprintInput,
  members: TeamMemberInput[],
  standups: StandupInput[],
  prReviews: PrReviewInput[],
  options?: { now?: Date | string | number; timezone?: string }
): TeamRequirementCheckResult;
export function checkSprintRequirements(
  arg1: CheckSprintRequirementsInput | SprintInput,
  arg2?: TeamMemberInput[],
  arg3?: CheckSprintRequirementsOptions | StandupInput[],
  arg4?: PrReviewInput[],
  arg5?: { now?: Date | string | number; timezone?: string }
): TeamRequirementCheckResult {
  const normalized = normalizeCheckSprintInput(arg1, arg2, arg3, arg4, arg5);
  const {
    sprint,
    members,
    standups = [],
    prReviews = [],
    memberCounts = {},
    now = new Date(),
    timezone,
  } = normalized;

  const boundaries = getSprintBoundaries(sprint, timezone);
  const sprintEnded = isSprintEnded(sprint, now, boundaries.timezone);
  const daysLeft = getCalendarDaysLeft(sprint, now, boundaries.timezone);

  const memberResults: MemberRequirementCheck[] = members.map((member) => {
    const memberId =
      member.id ?? member.memberId ?? member.userId ?? "";
    const counts = memberCounts[memberId] ?? {};
    const standupCount = counts.standupCount ?? counts.standups;
    const prReviewCount = counts.prReviewCount ?? counts.prReviews;

    return checkMemberRequirements(member, {
      sprint,
      standups,
      prReviews,
      standupCount,
      prReviewCount,
      now,
      timezone: boundaries.timezone,
    });
  });

  const allMet =
    memberResults.length === 0 ? true : memberResults.every((m) => m.isMet);
  const metCount = memberResults.filter((m) => m.isMet).length;
  const totalMembers = memberResults.length;
  const byMemberId: Record<string, MemberRequirementCheck> = {};
  for (const res of memberResults) {
    byMemberId[res.memberId] = res;
  }

  // Build hybrid result: Array + Properties
  const teamResult = Object.assign([...memberResults], {
    allMet,
    metCount,
    totalMembers,
    members: memberResults,
    byMemberId,
    sprintId: sprint.id,
    daysLeft,
    isSprintEnded: sprintEnded,
  }) as TeamRequirementCheckResult;

  return teamResult;
}

// Aliases for convenience and API consistency
export const checkTeamMemberRequirements = checkSprintRequirements;
export const checkTeamRequirements = checkSprintRequirements;
export const checkTeamSprintRequirements = checkSprintRequirements;
