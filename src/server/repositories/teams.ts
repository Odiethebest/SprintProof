import { databaseTextSchema } from "@/lib/validation/text";
import { db } from "@/server/db";
import { isUniqueViolation } from "@/server/prisma-errors";
import { generateWebhookSecret } from "@/server/webhook-secrets";
import { lockForWrite, REPO_CLAIM_LOCK } from "@/server/write-locks";
import { toPage, type Page } from "@/lib/api/pagination";
import type { TeamRole } from "@/lib/auth/team-access";
import type { CreateTeamInput } from "@/lib/teams/create-team";

const TEAM_FIELDS = {
  id: true,
  name: true,
  repoFullName: true,
  timezone: true,
} as const;

// Returns null when another team already connected the repo.
export async function createTeamWithLead({
  input,
  leadUserId,
}: {
  input: CreateTeamInput;
  leadUserId: string;
}) {
  try {
    return await db.$transaction(async (tx) => {
      // GitHub repository names ignore case; serialize all claims for that name.
      await lockForWrite({
        tx,
        kind: REPO_CLAIM_LOCK,
        id: input.repoFullName.toLowerCase(),
      });
      const existing = await tx.team.findFirst({
        where: {
          repoFullName: { equals: input.repoFullName, mode: "insensitive" },
        },
        select: { id: true },
      });
      if (existing !== null) return null;
      return tx.team.create({
        data: {
          ...input,
          webhookSecret: generateWebhookSecret(),
          memberships: { create: { userId: leadUserId, role: "LEAD" } },
        },
        select: TEAM_FIELDS,
      });
    });
  } catch (error) {
    // A unique index on the repo name caught a claim that got past the check
    // without taking the lock. Nothing else a new team writes can clash: its
    // id and its lead's membership are new, and repo_id is still empty.
    if (isUniqueViolation(error)) return null;
    throw error;
  }
}

export async function findTeam({ teamId }: { teamId: string }) {
  // An id PostgreSQL can't store (a NUL character) is an unknown team (#74).
  if (!databaseTextSchema.safeParse(teamId).success) return null;
  return db.team.findUnique({ where: { id: teamId }, select: TEAM_FIELDS });
}

// What the webhook route needs to verify a delivery for the team. The secret
// never leaves the server (decision 005, #115).
const WEBHOOK_TEAM_FIELDS = {
  id: true,
  repoFullName: true,
  repoId: true,
  webhookSecret: true,
  canUseServerWebhookSecret: true,
} as const;

// Only reads: the webhook route verifies the delivery's signature with the
// team's secret before it stores anything, the repo id included
// (recordTeamRepoId).
export async function findTeamByRepo({
  repoId,
  repoFullName,
}: {
  repoId?: bigint | null;
  repoFullName: string;
}) {
  if (repoId !== undefined && repoId !== null) {
    const byRepoId = await db.team.findUnique({
      where: { repoId },
      select: WEBHOOK_TEAM_FIELDS,
    });
    if (byRepoId !== null) {
      return byRepoId;
    }
  }

  // The name comes from a body nobody has verified yet. One PostgreSQL can't
  // store (a NUL character) names no team (#74).
  if (!databaseTextSchema.safeParse(repoFullName).success) {
    return null;
  }
  const byFullName = await db.team.findFirst({
    where: {
      repoFullName: { equals: repoFullName, mode: "insensitive" },
    },
    select: WEBHOOK_TEAM_FIELDS,
  });

  if (
    byFullName !== null &&
    repoId !== undefined &&
    repoId !== null &&
    byFullName.repoId !== null &&
    byFullName.repoId !== repoId
  ) {
    return null;
  }
  return byFullName;
}

// GitHub's repository id finds the team after a rename (#11). Stored from the
// first verified delivery; a team that already has one keeps it.
export async function recordTeamRepoId({
  teamId,
  repoId,
}: {
  teamId: string;
  repoId: bigint;
}): Promise<void> {
  await db.team.updateMany({
    where: { id: teamId, repoId: null },
    data: { repoId },
  });
}

// Decision 005 (#115): GitHub signed a delivery with the team's own secret,
// so the server-wide GITHUB_WEBHOOK_SECRET stops working for this team.
export async function stopServerWebhookSecret({
  teamId,
}: {
  teamId: string;
}): Promise<void> {
  await db.team.updateMany({
    where: { id: teamId, canUseServerWebhookSecret: true },
    data: { canUseServerWebhookSecret: false },
  });
}

// For the lead's Settings only. Callers check the role first.
export async function findTeamWebhookSecret({ teamId }: { teamId: string }) {
  return db.team.findUnique({
    where: { id: teamId },
    select: { webhookSecret: true, canUseServerWebhookSecret: true },
  });
}

// Replaces the team's secret with a new random one. Deliveries signed with
// the old one fail from now on. Whether the server-wide secret still works
// doesn't change: only a delivery signed with the team's secret ends that.
export async function rotateTeamWebhookSecret({
  teamId,
}: {
  teamId: string;
}): Promise<{ webhookSecret: string }> {
  return db.team.update({
    where: { id: teamId },
    data: { webhookSecret: generateWebhookSecret() },
    select: { webhookSecret: true },
  });
}

export async function listTeamsForUser({ userId }: { userId: string }) {
  const memberships = await db.membership.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { role: true, team: { select: TEAM_FIELDS } },
  });
  return memberships.map(({ role, team }) => ({ ...team, role }));
}

export interface TeamWithRole {
  id: string;
  name: string;
  repoFullName: string;
  timezone: string;
  role: TeamRole;
}

// In the order the user joined, as listTeamsForUser() orders them; the team id
// breaks ties so every team lands on exactly one page.
const MEMBERSHIP_PAGE_ORDER = [
  { createdAt: "asc" },
  { teamId: "asc" },
] as const;

// One page of the user's teams with their role there. The cursor is a team id.
// Returns null when the user isn't on that team, so a cursor can't come from
// anyone else's list.
export async function listTeamsPageForUser({
  userId,
  limit,
  cursor,
}: {
  userId: string;
  limit: number;
  cursor?: string;
}): Promise<Page<TeamWithRole> | null> {
  if (cursor !== undefined) {
    const cursorRow = await db.membership.findUnique({
      where: { userId_teamId: { userId, teamId: cursor } },
      select: { id: true },
    });
    if (cursorRow === null) {
      return null;
    }
  }
  const memberships = await db.membership.findMany({
    where: { userId },
    orderBy: [...MEMBERSHIP_PAGE_ORDER],
    take: limit + 1,
    ...(cursor === undefined
      ? {}
      : { cursor: { userId_teamId: { userId, teamId: cursor } }, skip: 1 }),
    select: { role: true, team: { select: TEAM_FIELDS } },
  });
  return toPage({
    rows: memberships.map(({ role, team }) => ({ ...team, role })),
    limit,
  });
}
