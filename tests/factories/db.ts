// Database record builders for integration tests. Not exported from ./index,
// so unit tests never import the Prisma client.
import { db } from "@/server/db";
import type { TeamRole } from "@/lib/auth/team-access";
import type { InviteRole } from "@/lib/invites/invite-link";

const DAY_MS = 24 * 60 * 60 * 1000;

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

export async function insertInvite(input: {
  teamId: string;
  role: InviteRole;
  token?: string;
  expiresAt?: Date;
  revokedAt?: Date | null;
}) {
  const n = recordSeq++;
  return db.invite.create({
    data: {
      token: `invite-token-${n}`,
      expiresAt: new Date(Date.now() + 7 * DAY_MS),
      revokedAt: null,
      ...input,
    },
  });
}

export async function insertSprint(input: {
  teamId: string;
  name?: string;
  startDate?: string | Date;
  endDate?: string | Date;
  standupsPerPerson?: number;
  reviewsPerPerson?: number;
}) {
  const n = recordSeq++;
  return db.sprint.create({
    data: {
      teamId: input.teamId,
      name: input.name ?? `Sprint ${n}`,
      startDate:
        typeof input.startDate === "string"
          ? new Date(`${input.startDate}T00:00:00.000Z`)
          : (input.startDate ?? new Date("2026-10-29T00:00:00.000Z")),
      endDate:
        typeof input.endDate === "string"
          ? new Date(`${input.endDate}T00:00:00.000Z`)
          : (input.endDate ?? new Date("2026-11-04T00:00:00.000Z")),
      standupsPerPerson: input.standupsPerPerson ?? 3,
      reviewsPerPerson: input.reviewsPerPerson ?? 5,
    },
  });
}

export async function insertStandup(input: {
  sprintId: string;
  userId: string;
  date: string;
  yesterday?: string;
  today?: string;
  blockers?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}) {
  return db.standup.create({
    data: {
      yesterday: "GitHub sign-in works on preview deploys (#6).",
      today: "Team creation and invite links (#7).",
      blockers: null,
      ...input,
      date: new Date(`${input.date}T00:00:00.000Z`),
    },
  });
}
