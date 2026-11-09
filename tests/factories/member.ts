import type { Member } from "@/lib/checks/requirement-status";
import type { SummaryMemberInput } from "@/lib/stats/sprint-summary";

let memberSeq = 1;

export function resetMemberSeq(): void {
  memberSeq = 1;
}

export function createMember(overrides: Partial<Member> = {}): Member {
  const id = memberSeq++;
  return {
    userId: `user-${id}`,
    githubLogin: `user${id}`,
    ...overrides,
  };
}

// A team member as the sprint summary takes it: with a name and a role.
export function createTeamMember(
  overrides: Partial<SummaryMemberInput> = {}
): SummaryMemberInput {
  const id = memberSeq++;
  return {
    userId: `user-${id}`,
    name: `Member ${id}`,
    githubLogin: `user${id}`,
    role: "MEMBER",
    ...overrides,
  };
}
