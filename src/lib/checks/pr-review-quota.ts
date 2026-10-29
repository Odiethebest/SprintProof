import {
  getCalendarDaysLeft,
  getSprintBoundaries,
  isWithinSprint,
} from "../sprints/boundaries";
import {
  PrReviewInput,
  RequirementCheckItem,
  RequirementStatus,
  SprintInput,
  TeamMemberInput,
} from "./types";

export interface CheckPrReviewQuotaOptions {
  now?: Date | string | number;
  timezone?: string;
  precomputedCount?: number;
}

const VALID_REVIEW_STATES = new Set([
  "APPROVED",
  "CHANGES_REQUESTED",
  "COMMENTED",
]);

/**
 * Checks if a login corresponds to a bot account.
 * Per Rule R4: "ignore bots (logins ending in [bot])".
 */
export function isBotLogin(login?: string | null): boolean {
  if (!login) return false;
  return login.trim().toLowerCase().endsWith("[bot]");
}

/**
 * Checks if a PR review is a self-review (reviewing one's own PR).
 * Per Rule R3: "Reviews on your own PR never count."
 */
export function isSelfReview(
  member: TeamMemberInput,
  review: PrReviewInput
): boolean {
  const memberId = member.id ?? member.memberId ?? member.userId;
  const memberLogin = member.githubLogin?.toLowerCase().trim();

  const reviewerId = review.reviewerId ?? review.memberId ?? review.userId;
  const reviewerLogin = (review.reviewerLogin ?? review.authorLogin)?.toLowerCase().trim();

  const prAuthorId = review.prAuthorId ?? review.authorId;
  const prAuthorLogin = (review.prAuthorLogin ?? review.pullRequestAuthorLogin)?.toLowerCase().trim();

  // Compare review's reviewer and author directly
  if (reviewerId && prAuthorId && reviewerId === prAuthorId) {
    return true;
  }
  if (reviewerLogin && prAuthorLogin && reviewerLogin === prAuthorLogin) {
    return true;
  }

  // Compare member to prAuthor
  if (memberId && prAuthorId && memberId === prAuthorId) {
    return true;
  }
  if (memberLogin && prAuthorLogin && memberLogin === prAuthorLogin) {
    return true;
  }

  return false;
}

/**
 * Checks whether a review belongs to the given member.
 */
export function doesReviewBelongToMember(
  member: TeamMemberInput,
  review: PrReviewInput
): boolean {
  const memberId = member.id ?? member.memberId ?? member.userId;
  const memberLogin = member.githubLogin?.toLowerCase().trim();

  const reviewerId = review.reviewerId ?? review.memberId ?? review.userId;
  const reviewerLogin = (review.reviewerLogin ?? review.authorLogin)?.toLowerCase().trim();

  if (memberId && reviewerId && memberId === reviewerId) {
    return true;
  }

  if (memberLogin && reviewerLogin && memberLogin === reviewerLogin) {
    return true;
  }

  return false;
}

/**
 * Counts qualifying PR reviews for a team member within a sprint window.
 *
 * Per Business Rules R3 & R4:
 * - A review counts when a member submits a review (approved, changes requested, or commented)
 *   on a PR authored by someone else.
 * - Count distinct PRs per reviewer. Three reviews on the same PR count as one.
 * - Reviews on your own PR never count.
 * - Bots are ignored.
 */
export function countQualifyingPrReviews(
  member: TeamMemberInput,
  prReviews: PrReviewInput[],
  sprint: SprintInput,
  fallbackTimezone?: string
): number {
  if (isBotLogin(member.githubLogin)) {
    return 0;
  }

  const boundaries = getSprintBoundaries(sprint, fallbackTimezone);
  const distinctPrs = new Set<string>();

  for (const review of prReviews) {
    const reviewerLogin = review.reviewerLogin ?? review.authorLogin;
    if (isBotLogin(reviewerLogin)) {
      continue;
    }

    if (!doesReviewBelongToMember(member, review)) {
      continue;
    }

    if (isSelfReview(member, review)) {
      continue;
    }

    const ts = review.submittedAt ?? review.createdAt ?? review.timestamp;
    if (ts === undefined || ts === null) {
      continue;
    }

    if (!isWithinSprint(ts, sprint, boundaries.timezone)) {
      continue;
    }

    // If state is provided, check that it's an approved, changes_requested, or commented review
    if (review.state) {
      const normalizedState = review.state.toUpperCase().trim();
      if (!VALID_REVIEW_STATES.has(normalizedState)) {
        continue;
      }
    }

    const prKey = String(
      review.prId ??
        review.pullRequestId ??
        review.prNumber ??
        review.prUrl ??
        ""
    );
    if (!prKey) {
      continue;
    }

    distinctPrs.add(prKey);
  }

  return distinctPrs.size;
}

/**
 * Determines requirement status (MET, ON_TRACK, AT_RISK, MISSED).
 */
export function computePrReviewStatus(params: {
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
 * Evaluates a member's PR review requirement against the sprint rules.
 */
export function checkPrReviewQuota(
  member: TeamMemberInput,
  prReviews: PrReviewInput[],
  sprint: SprintInput,
  options: CheckPrReviewQuotaOptions = {}
): RequirementCheckItem {
  const { now = new Date(), timezone, precomputedCount } = options;
  const boundaries = getSprintBoundaries(sprint, timezone);

  const target =
    sprint.prReviewsPerPerson ??
    sprint.requiredPrReviews ??
    sprint.prReviewQuota ??
    5;

  const count =
    precomputedCount !== undefined
      ? precomputedCount
      : countQualifyingPrReviews(member, prReviews, sprint, boundaries.timezone);

  const daysLeft = getCalendarDaysLeft(sprint, now, boundaries.timezone);
  const status = computePrReviewStatus({
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
    : `${remaining} ${remaining === 1 ? "PR review" : "PR reviews"} to go`;

  return {
    requirement: "prReviews",
    count,
    target,
    required: target,
    remaining,
    status,
    isMet,
    message,
  };
}
