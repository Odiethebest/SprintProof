import type { MemberSummary, SprintSummary } from "@/lib/stats/sprint-summary";

let memberSummarySeq = 1;

export function resetMemberSummarySeq(): void {
  memberSummarySeq = 1;
}

// A member's row in a sprint summary, as buildSprintSummary() returns it.
// Defaults to nothing done yet in a running sprint.
export function createMemberSummary(
  overrides: Partial<MemberSummary> = {}
): MemberSummary {
  const id = memberSummarySeq++;
  return {
    userId: `user-${id}`,
    name: `Member ${id}`,
    githubLogin: `user${id}`,
    role: "MEMBER",
    commits: 0,
    pullRequests: 0,
    standups: { count: 0, required: 3, remaining: 3, status: "ON_TRACK" },
    reviews: { count: 0, required: 5, remaining: 5, status: "ON_TRACK" },
    ...overrides,
  };
}

// Sprint 1 (Oct 29 – Nov 4, 2026) on Nov 3 at noon in Los Angeles: running,
// with 2 days left counting today.
export function createSprintSummary(
  overrides: Partial<SprintSummary> = {}
): SprintSummary {
  return {
    sprint: {
      id: "sprint-1",
      name: "Sprint 1",
      startDate: "2026-10-29",
      endDate: "2026-11-04",
      standupsPerPerson: 3,
      reviewsPerPerson: 5,
      state: "CURRENT",
      daysLeft: 2,
    },
    countsAsOf: new Date("2026-11-03T20:00:00Z"),
    members: [],
    ...overrides,
  };
}
