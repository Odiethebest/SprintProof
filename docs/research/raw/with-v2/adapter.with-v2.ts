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

// Wired to this branch's implementation: computeRequirementStatus() in
// src/lib/checks/requirement-status.ts (its only signature, an options object). It accepts every
// activity type and filters to REVIEW itself, so all activities are passed through unchanged.
// Sprint dates become midnight in the team timezone, as the AI's own sprint factory builds them.
import { TZDate } from "@date-fns/tz";
import { computeRequirementStatus } from "../../src/lib/checks/requirement-status";

function toTeamMidnight(date: string, timeZone: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new TZDate(year, month - 1, day, timeZone);
}

export function computeStatus(input: ReferenceInput): MemberResult[] {
  const results = computeRequirementStatus({
    sprint: {
      id: "sprint-1",
      startDate: toTeamMidnight(input.sprint.startDate, input.timeZone),
      endDate: toTeamMidnight(input.sprint.endDate, input.timeZone),
      timezone: input.timeZone,
      standupsPerPerson: input.sprint.standupsPerPerson,
      reviewsPerPerson: input.sprint.reviewsPerPerson,
    },
    members: input.members.map((m) => ({ userId: m.id, githubLogin: m.githubLogin })),
    standups: input.standups.map((s, i) => ({
      id: `standup-${i}`,
      userId: s.memberId,
      createdAt: new Date(s.submittedAt),
    })),
    activities: input.activities.map((a, i) => ({
      id: `activity-${i}`,
      type: a.type,
      actorLogin: a.githubLogin,
      prNumber: a.prNumber,
      prAuthorLogin: a.prAuthorLogin,
      createdAt: new Date(a.occurredAt),
    })),
    now: new Date(input.now),
  });

  return results.map((r) => ({
    memberId: r.userId,
    standups: { count: r.standups.count, required: r.standups.required, status: r.standups.status },
    reviews: { count: r.reviews.count, required: r.reviews.required, status: r.reviews.status },
  }));
}
