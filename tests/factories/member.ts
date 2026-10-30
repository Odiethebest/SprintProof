import type { Member } from "@/lib/checks/requirement-status";

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
