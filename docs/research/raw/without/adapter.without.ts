// Adapter for the issue #10 reference tests (HW3 rules experiment).
//
// The tests only ever call computeStatus() with the input shape below. To measure an
// implementation, edit only this file: convert ReferenceInput into that implementation's
// types, call it, and convert its result back into MemberResult[].

export type ActivityType = "COMMIT" | "PR_OPENED" | "PR_MERGED" | "REVIEW";
export type RequirementStatus = "MET" | "ON_TRACK" | "AT_RISK" | "MISSED";

export interface ReferenceSprint {
  startDate: string; // YYYY-MM-DD, team timezone
  endDate: string; // YYYY-MM-DD, team timezone, inclusive
  standupsPerPerson: number;
  reviewsPerPerson: number;
}

export interface ReferenceMember {
  id: string;
  githubLogin: string | null;
}

export interface ReferenceStandup {
  memberId: string;
  submittedAt: string; // ISO 8601 instant
}

export interface ReferenceActivity {
  type: ActivityType;
  githubLogin: string;
  prNumber?: number;
  prAuthorLogin?: string;
  sha?: string;
  occurredAt: string; // ISO 8601 instant
}

export interface ReferenceInput {
  sprint: ReferenceSprint;
  timeZone: string; // IANA name, e.g. America/Los_Angeles
  now: string; // ISO 8601 instant
  members: ReferenceMember[];
  standups: ReferenceStandup[];
  activities: ReferenceActivity[];
}

export interface RequirementResult {
  count: number;
  required: number;
  status: RequirementStatus;
}

export interface MemberResult {
  memberId: string;
  standups: RequirementResult;
  reviews: RequirementResult;
}

// Wired to experiment/without-rules: checkSprintRequirements() in src/lib/checks.
// Its prReviews input only models reviews, so only REVIEW activities are passed in.
import { checkSprintRequirements } from "../../src/lib/checks";
import type { RequirementCheckItem } from "../../src/lib/checks";

function toResult(item: RequirementCheckItem): RequirementResult {
  return { count: item.count, required: item.required, status: item.status };
}

export function computeStatus(input: ReferenceInput): MemberResult[] {
  const results = checkSprintRequirements({
    sprint: {
      startDate: input.sprint.startDate,
      endDate: input.sprint.endDate,
      standupsPerPerson: input.sprint.standupsPerPerson,
      prReviewsPerPerson: input.sprint.reviewsPerPerson,
    },
    members: input.members.map((m) => ({ id: m.id, githubLogin: m.githubLogin })),
    standups: input.standups.map((s) => ({ memberId: s.memberId, createdAt: s.submittedAt })),
    prReviews: input.activities
      .filter((a) => a.type === "REVIEW")
      .map((a) => ({
        reviewerLogin: a.githubLogin,
        prNumber: a.prNumber,
        prAuthorLogin: a.prAuthorLogin,
        submittedAt: a.occurredAt,
      })),
    now: input.now,
    timezone: input.timeZone,
  });

  return results.members.map((r) => ({
    memberId: r.memberId,
    standups: toResult(r.standups),
    reviews: toResult(r.prReviews),
  }));
}
