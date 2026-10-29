import { SprintDateRange } from "../sprints/boundaries";

export type RequirementStatus = "MET" | "ON_TRACK" | "AT_RISK" | "MISSED";

export type RequirementStatusLabel = "Met" | "On track" | "At risk" | "Missed";

export const STATUS_LABELS: Record<RequirementStatus, RequirementStatusLabel> = {
  MET: "Met",
  ON_TRACK: "On track",
  AT_RISK: "At risk",
  MISSED: "Missed",
};

export interface RequirementCheckItem {
  requirement: "standups" | "prReviews";
  count: number;
  target: number;
  required: number;
  remaining: number;
  status: RequirementStatus;
  isMet: boolean;
  message: string;
}

export interface MemberRequirementCheck {
  memberId: string;
  name?: string;
  memberName?: string;
  githubLogin?: string | null;
  standups: RequirementCheckItem;
  prReviews: RequirementCheckItem;
  isMet: boolean;
  status: RequirementStatus;
}

export interface TeamRequirementCheckResult extends Array<MemberRequirementCheck> {
  allMet: boolean;
  metCount: number;
  totalMembers: number;
  members: MemberRequirementCheck[];
  byMemberId: Record<string, MemberRequirementCheck>;
  sprintId?: string;
  daysLeft: number;
  isSprintEnded: boolean;
}

export interface TeamMemberInput {
  id?: string;
  memberId?: string;
  userId?: string;
  name?: string;
  memberName?: string;
  githubLogin?: string | null;
  role?: string;
}

export interface SprintInput extends SprintDateRange {
  id?: string;
  name?: string;
  standupsPerPerson?: number;
  requiredStandups?: number;
  standupQuota?: number;
  prReviewsPerPerson?: number;
  requiredPrReviews?: number;
  prReviewQuota?: number;
}

export interface StandupInput {
  id?: string;
  memberId?: string;
  userId?: string;
  authorId?: string;
  createdAt?: Date | string | number;
  timestamp?: Date | string | number;
  date?: Date | string | number;
  yesterday?: string;
  today?: string;
  blockers?: string;
}

export interface PrReviewInput {
  id?: string | number;
  reviewerId?: string;
  memberId?: string;
  userId?: string;
  reviewerLogin?: string;
  authorLogin?: string;
  prId?: string | number;
  pullRequestId?: string | number;
  prNumber?: string | number;
  prUrl?: string;
  prAuthorId?: string;
  authorId?: string;
  prAuthorLogin?: string;
  pullRequestAuthorLogin?: string;
  state?: string;
  submittedAt?: Date | string | number;
  createdAt?: Date | string | number;
  timestamp?: Date | string | number;
}

export interface CheckSprintRequirementsInput {
  sprint: SprintInput;
  members: TeamMemberInput[];
  standups?: StandupInput[];
  prReviews?: PrReviewInput[];
  memberCounts?: Record<
    string,
    { standups?: number; prReviews?: number; standupCount?: number; prReviewCount?: number }
  >;
  now?: Date | string | number;
  timezone?: string;
}

export interface CheckSprintRequirementsOptions {
  standups?: StandupInput[];
  prReviews?: PrReviewInput[];
  memberCounts?: Record<
    string,
    { standups?: number; prReviews?: number; standupCount?: number; prReviewCount?: number }
  >;
  now?: Date | string | number;
  timezone?: string;
}
