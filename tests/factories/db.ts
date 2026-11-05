// Database record builders for integration tests. Not exported from ./index,
// so unit tests never import the Prisma client.
import { db } from "@/server/db";
import type { TeamRole } from "@/lib/auth/team-access";

let recordSeq = 1;

interface UserRecordOverrides {
  githubId?: string;
  githubLogin?: string | null;
  name?: string | null;
  avatarUrl?: string | null;
}

export async function insertUser(overrides: UserRecordOverrides = {}) {
  const n = recordSeq++;
  return db.user.create({
    data: {
      githubId: `${9000 + n}`,
      githubLogin: `member${n}`,
      name: `Member ${n}`,
      avatarUrl: null,
      ...overrides,
    },
  });
}

export async function insertTeam(
  overrides: { name?: string; repoFullName?: string; timezone?: string } = {}
) {
  const n = recordSeq++;
  return db.team.create({
    data: {
      name: `Team ${n}`,
      repoFullName: `owner${n}/repo${n}`,
      ...overrides,
    },
  });
}

export async function insertMembership(input: {
  userId: string;
  teamId: string;
  role: TeamRole;
}) {
  return db.membership.create({ data: input });
}
