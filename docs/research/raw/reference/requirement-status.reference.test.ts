// Reference tests for issue #10, "Compute requirement status per member" (HW3 rules experiment).
// Written from docs/PRD.md §6 (R1–R5) before either experiment round, and kept outside the
// repo until both rounds are done. They call the implementation only through ./adapter.
//
// Definitions these tests rely on:
// - Team timezone America/Los_Angeles. In 2026 daylight time ends on Sun Nov 1 at 02:00,
//   so Oct 28–31 are UTC−7 and Nov 1–6 are UTC−8.
// - "Days left" = sprint end date − today's date in the team timezone + 1, in calendar days;
//   today counts as a day. Today Nov 3 with the sprint ending Nov 4 → 2 days left; on the
//   last day → 1. This matches the prototype (docs/design/02-dashboard.png: "2 days left" on Nov 3).
// - Status (R5): MET if count ≥ required; otherwise MISSED once the sprint has ended;
//   otherwise AT_RISK with 2 or fewer days left; otherwise ON_TRACK.

import { describe, expect, it } from "vitest";
import {
  computeStatus,
  type MemberResult,
  type ReferenceActivity,
  type ReferenceInput,
  type ReferenceMember,
  type ReferenceStandup,
} from "./adapter";

const TEAM_TIME_ZONE = "America/Los_Angeles";

// Sprint 1: Thu Oct 29 – Wed Nov 4, 2026; 3 standups and 5 PR reviews per person.
const SPRINT = { startDate: "2026-10-29", endDate: "2026-11-04", standupsPerPerson: 3, reviewsPerPerson: 5 };

// "now" values, all at noon in the team timezone unless noted.
const MID_SPRINT = "2026-10-31T19:00:00Z"; // Sat Oct 31, 12:00 PDT → 5 days left
const NOV_1_NOON = "2026-11-01T20:00:00Z"; // Sun Nov 1, 12:00 PST → 4 days left
const NOV_2_NOON = "2026-11-02T20:00:00Z"; // Mon Nov 2, 12:00 PST → 3 days left
const NOV_2_LATE_EVENING = "2026-11-03T06:00:00Z"; // Mon Nov 2, 22:00 PST (already Nov 3 in UTC) → 3 days left
const NOV_3_NOON = "2026-11-03T20:00:00Z"; // Tue Nov 3, 12:00 PST → 2 days left
const AFTER_SPRINT = "2026-11-06T20:00:00Z"; // Fri Nov 6, 12:00 PST → sprint has ended

const alice: ReferenceMember = { id: "member-alice", githubLogin: "alice" };
const bob: ReferenceMember = { id: "member-bob", githubLogin: "bob" };

function buildInput(overrides: Partial<ReferenceInput> = {}): ReferenceInput {
  return {
    sprint: SPRINT,
    timeZone: TEAM_TIME_ZONE,
    now: MID_SPRINT,
    members: [alice, bob],
    standups: [],
    activities: [],
    ...overrides,
  };
}

function standup(member: ReferenceMember, submittedAt: string): ReferenceStandup {
  return { memberId: member.id, submittedAt };
}

function review(reviewerLogin: string, prNumber: number, prAuthorLogin: string, occurredAt: string): ReferenceActivity {
  return { type: "REVIEW", githubLogin: reviewerLogin, prNumber, prAuthorLogin, occurredAt };
}

// Reviews on PRs 101–10n, all authored by `prAuthorLogin`, one per hour from Oct 29 10:00 PDT.
function reviewsOnDistinctPrs(reviewerLogin: string, prAuthorLogin: string, n: number): ReferenceActivity[] {
  return Array.from({ length: n }, (_, i) =>
    review(reviewerLogin, 101 + i, prAuthorLogin, `2026-10-29T${String(17 + i).padStart(2, "0")}:00:00Z`),
  );
}

// One standup per day at 12:00 PDT on Oct 29, 30, 31, ...
function standupsOnDistinctDays(member: ReferenceMember, n: number): ReferenceStandup[] {
  return Array.from({ length: n }, (_, i) => standup(member, `2026-10-${29 + i}T19:00:00Z`));
}

function resultFor(results: MemberResult[], member: ReferenceMember): MemberResult {
  const result = results.find((r) => r.memberId === member.id);
  if (!result) throw new Error(`no result for ${member.id}`);
  return result;
}

describe("requirement status reference tests (issue #10)", () => {
  // 1
  it("marks both requirements ON_TRACK when the sprint is running and nobody has done anything yet", () => {
    // Arrange
    const input = buildInput();

    // Act
    const results = computeStatus(input);

    // Assert
    expect(resultFor(results, alice).standups).toEqual({ count: 0, required: 3, status: "ON_TRACK" });
    expect(resultFor(results, alice).reviews).toEqual({ count: 0, required: 5, status: "ON_TRACK" });
  });

  // 2
  it("marks standups MET once the count equals the requirement", () => {
    // Arrange
    const input = buildInput({ now: NOV_1_NOON, standups: standupsOnDistinctDays(alice, 3) });

    // Act
    const results = computeStatus(input);

    // Assert
    expect(resultFor(results, alice).standups).toEqual({ count: 3, required: 3, status: "MET" });
  });

  // 3 (R2)
  it("counts two standups on the same team-timezone day as one, even when they fall on different UTC dates", () => {
    // Arrange: Fri Oct 30 08:00 PDT and Fri Oct 30 22:00 PDT (= Sat Oct 31 05:00 UTC)
    const input = buildInput({
      standups: [standup(alice, "2026-10-30T15:00:00Z"), standup(alice, "2026-10-31T05:00:00Z")],
    });

    // Act
    const results = computeStatus(input);

    // Assert
    expect(resultFor(results, alice).standups.count).toBe(1);
  });

  // 4a (R1)
  it("counts a standup at 23:59 team time on the sprint's last day", () => {
    // Arrange: Wed Nov 4 23:59 PST
    const input = buildInput({ now: AFTER_SPRINT, standups: [standup(alice, "2026-11-05T07:59:00Z")] });

    // Act
    const results = computeStatus(input);

    // Assert
    expect(resultFor(results, alice).standups.count).toBe(1);
  });

  // 4b (R1)
  it("does not count a standup at 00:00 team time on the day after the sprint ends", () => {
    // Arrange: Thu Nov 5 00:00 PST
    const input = buildInput({ now: AFTER_SPRINT, standups: [standup(alice, "2026-11-05T08:00:00Z")] });

    // Act
    const results = computeStatus(input);

    // Assert
    expect(resultFor(results, alice).standups.count).toBe(0);
  });

  // 5 (R1)
  it("does not count a standup at 23:30 team time the day before the sprint starts, though its UTC date is the start date", () => {
    // Arrange: Wed Oct 28 23:30 PDT (= Thu Oct 29 06:30 UTC)
    const input = buildInput({ standups: [standup(alice, "2026-10-29T06:30:00Z")] });

    // Act
    const results = computeStatus(input);

    // Assert
    expect(resultFor(results, alice).standups.count).toBe(0);
  });

  // 5, extra (R1)
  it("counts a standup at 00:00 team time on the sprint's first day", () => {
    // Arrange: Thu Oct 29 00:00 PDT
    const input = buildInput({ standups: [standup(alice, "2026-10-29T07:00:00Z")] });

    // Act
    const results = computeStatus(input);

    // Assert
    expect(resultFor(results, alice).standups.count).toBe(1);
  });

  // 6 (R3)
  it("counts three reviews by the same member on the same PR as one", () => {
    // Arrange
    const input = buildInput({
      activities: [
        review("alice", 7, "bob", "2026-10-29T18:00:00Z"),
        review("alice", 7, "bob", "2026-10-29T20:00:00Z"),
        review("alice", 7, "bob", "2026-10-30T16:00:00Z"),
      ],
    });

    // Act
    const results = computeStatus(input);

    // Assert
    expect(resultFor(results, alice).reviews.count).toBe(1);
  });

  // 7 (R3)
  it("does not count a review on the member's own PR", () => {
    // Arrange
    const input = buildInput({ activities: [review("alice", 8, "alice", "2026-10-30T16:00:00Z")] });

    // Act
    const results = computeStatus(input);

    // Assert
    expect(resultFor(results, alice).reviews.count).toBe(0);
  });

  // 8 (R3, R5)
  it("marks reviews MET after reviews on five different PRs by someone else", () => {
    // Arrange
    const input = buildInput({ activities: reviewsOnDistinctPrs("alice", "bob", 5) });

    // Act
    const results = computeStatus(input);

    // Assert
    expect(resultFor(results, alice).reviews).toEqual({ count: 5, required: 5, status: "MET" });
  });

  // 9 (R4)
  it("ignores reviews from a login ending in [bot], even when that login is mapped to a member", () => {
    // Arrange
    const botMember: ReferenceMember = { id: "member-ci-bot", githubLogin: "sprintproof-ci[bot]" };
    const input = buildInput({
      members: [alice, botMember],
      activities: reviewsOnDistinctPrs("sprintproof-ci[bot]", "alice", 5),
    });

    // Act
    const results = computeStatus(input);

    // Assert
    expect(resultFor(results, botMember).reviews.count).toBe(0);
  });

  // 10
  it("ignores activity from GitHub logins that aren't team members", () => {
    // Arrange
    const input = buildInput({
      activities: [
        ...reviewsOnDistinctPrs("carol", "alice", 5),
        { type: "COMMIT", githubLogin: "carol", sha: "c0ffee1", occurredAt: "2026-10-30T16:00:00Z" },
      ],
    });

    // Act
    const results = computeStatus(input);

    // Assert
    expect(results.map((r) => r.memberId).sort()).toEqual([alice.id, bob.id].sort());
    expect(resultFor(results, alice).reviews.count).toBe(0);
    expect(resultFor(results, bob).reviews.count).toBe(0);
  });

  // 11
  it("does not count commits, opened PRs or merged PRs as reviews", () => {
    // Arrange
    const input = buildInput({
      activities: [
        { type: "COMMIT", githubLogin: "alice", sha: "a1b2c3d", occurredAt: "2026-10-29T18:00:00Z" },
        { type: "PR_OPENED", githubLogin: "alice", prNumber: 9, prAuthorLogin: "alice", occurredAt: "2026-10-29T19:00:00Z" },
        { type: "PR_MERGED", githubLogin: "alice", prNumber: 10, prAuthorLogin: "bob", occurredAt: "2026-10-30T19:00:00Z" },
      ],
    });

    // Act
    const results = computeStatus(input);

    // Assert
    expect(resultFor(results, alice).reviews.count).toBe(0);
  });

  // 12a (R5)
  it("marks unmet requirements AT_RISK with 2 days left (today Nov 3, sprint ends Nov 4)", () => {
    // Arrange
    const input = buildInput({ now: NOV_3_NOON, standups: standupsOnDistinctDays(alice, 1) });

    // Act
    const results = computeStatus(input);

    // Assert
    expect(resultFor(results, alice).standups.status).toBe("AT_RISK");
    expect(resultFor(results, alice).reviews.status).toBe("AT_RISK");
  });

  // 12b (R5)
  it("marks unmet requirements ON_TRACK with 3 days left (today Nov 2, sprint ends Nov 4)", () => {
    // Arrange
    const input = buildInput({ now: NOV_2_NOON, standups: standupsOnDistinctDays(alice, 1) });

    // Act
    const results = computeStatus(input);

    // Assert
    expect(resultFor(results, alice).standups.status).toBe("ON_TRACK");
    expect(resultFor(results, alice).reviews.status).toBe("ON_TRACK");
  });

  // 12, extra (R1, R5)
  it("works out today's date in the team timezone: 22:00 PST on Nov 2 still has 3 days left", () => {
    // Arrange: already Nov 3 in UTC
    const input = buildInput({ now: NOV_2_LATE_EVENING });

    // Act
    const results = computeStatus(input);

    // Assert
    expect(resultFor(results, alice).standups.status).toBe("ON_TRACK");
  });

  // 13a (R5)
  it("marks unmet requirements MISSED once the sprint has ended", () => {
    // Arrange
    const input = buildInput({
      now: AFTER_SPRINT,
      standups: standupsOnDistinctDays(alice, 1),
      activities: reviewsOnDistinctPrs("alice", "bob", 2),
    });

    // Act
    const results = computeStatus(input);

    // Assert
    expect(resultFor(results, alice).standups).toEqual({ count: 1, required: 3, status: "MISSED" });
    expect(resultFor(results, alice).reviews).toEqual({ count: 2, required: 5, status: "MISSED" });
  });

  // 13b (R5)
  it("keeps met requirements MET after the sprint has ended", () => {
    // Arrange
    const input = buildInput({
      now: AFTER_SPRINT,
      standups: standupsOnDistinctDays(alice, 3),
      activities: reviewsOnDistinctPrs("alice", "bob", 5),
    });

    // Act
    const results = computeStatus(input);

    // Assert
    expect(resultFor(results, alice).standups.status).toBe("MET");
    expect(resultFor(results, alice).reviews.status).toBe("MET");
  });

  // 14
  it("returns an empty list when the team has no members", () => {
    // Arrange
    const input = buildInput({
      members: [],
      standups: standupsOnDistinctDays(alice, 2),
      activities: reviewsOnDistinctPrs("alice", "bob", 2),
    });

    // Act
    const results = computeStatus(input);

    // Assert
    expect(results).toEqual([]);
  });

  // 15
  it("counts standups for a member with no GitHub login and gives them 0 reviews without throwing", () => {
    // Arrange
    const noLogin: ReferenceMember = { id: "member-no-login", githubLogin: null };
    const input = buildInput({
      members: [noLogin, bob],
      standups: standupsOnDistinctDays(noLogin, 2),
      activities: reviewsOnDistinctPrs("bob", "carol", 2),
    });

    // Act
    const results = computeStatus(input);

    // Assert
    expect(resultFor(results, noLogin).standups.count).toBe(2);
    expect(resultFor(results, noLogin).reviews.count).toBe(0);
  });

  // Extra (R1, R3)
  it("does not count a review submitted before the sprint starts", () => {
    // Arrange: Wed Oct 28 12:00 PDT
    const input = buildInput({ activities: [review("alice", 11, "bob", "2026-10-28T19:00:00Z")] });

    // Act
    const results = computeStatus(input);

    // Assert
    expect(resultFor(results, alice).reviews.count).toBe(0);
  });
});
