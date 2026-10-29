import { TeamMemberInput } from "@/lib/checks/types";

let memberCounter = 1;

export function createMockMember(overrides: Partial<TeamMemberInput> = {}): TeamMemberInput {
  const num = memberCounter++;
  const id = overrides.id ?? `member-${num}`;
  return {
    id,
    name: overrides.name ?? `Member ${num}`,
    githubLogin: overrides.githubLogin !== undefined ? overrides.githubLogin : `user-${num}`,
    role: overrides.role ?? "MEMBER",
    ...overrides,
  };
}
