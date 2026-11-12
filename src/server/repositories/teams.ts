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

// Decision 007 (#117): only a team whose repository GitHub's ping verified
// has it. A pending team's repo_verified_at is null.
const VERIFIED_REPO = { repoVerifiedAt: { not: null } } as const;

// A filter for repository names equal to this one ignoring case, and nothing
// else. Prisma runs `equals` with `mode: "insensitive"` as ILIKE without
// escaping the value, so "_" (which GitHub allows in names) and "%" (which a
// forged payload can hold) would match other characters too. Escaped with
// PostgreSQL's default LIKE escape, the backslash, they match only themselves.
function sameRepoName(repoFullName: string) {
  return {
    equals: repoFullName.replace(/[\\%_]/g, "\\$&"),
    mode: "insensitive",
  } as const;
}

// The new team's repository is pending until GitHub's ping verifies it
// (decision 007, #117). Returns null when another team is verified for the
// repository; teams that only have it pending don't block anyone.
export async function createTeamWithLead({
  input,
  leadUserId,
}: {
  input: CreateTeamInput;
  leadUserId: string;
}) {
  return db.$transaction(async (tx) => {
    // GitHub repository names ignore case. Claims and verifications of one
    // name wait for each other, so a claim made after a verification sees it.
    await lockForWrite({
      tx,
      kind: REPO_CLAIM_LOCK,
      id: input.repoFullName.toLowerCase(),
    });
    const verified = await tx.team.findFirst({
      where: {
        repoFullName: sameRepoName(input.repoFullName),
        ...VERIFIED_REPO,
      },
      select: { id: true },
    });
    if (verified !== null) return null;
    // Pending, with no repo id: no unique index can reject it.
    return tx.team.create({
      data: {
        ...input,
        webhookSecret: generateWebhookSecret(),
        memberships: { create: { userId: leadUserId, role: "LEAD" } },
      },
      select: TEAM_FIELDS,
    });
  });
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

// The team verified for the repository (decision 007, #117), or null.
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
    const byRepoId = await db.team.findFirst({
      where: { repoId, ...VERIFIED_REPO },
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
      repoFullName: sameRepoName(repoFullName),
      ...VERIFIED_REPO,
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

// The teams that have the repository pending, oldest first: each one's secret
// may have signed the ping that verifies it (decision 007, #117). Only reads.
export async function findPendingTeamsByRepo({
  repoFullName,
}: {
  repoFullName: string;
}): Promise<{ id: string; webhookSecret: string }[]> {
  // The name comes from a body nobody has verified yet (#74).
  if (!databaseTextSchema.safeParse(repoFullName).success) {
    return [];
  }
  return db.team.findMany({
    where: {
      repoFullName: sameRepoName(repoFullName),
      repoVerifiedAt: null,
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, webhookSecret: true },
  });
}

// Decision 007 (#117): GitHub's ping, signed with this pending team's own
// secret, verifies the team for the repository and stores the repository id.
// The ping also proves GitHub signs with the team's secret, so the
// server-wide secret stops working for it (decision 005). Returns false,
// changing nothing, when another team is verified for the repository.
export async function verifyTeamRepo({
  teamId,
  repoId,
  repoFullName,
}: {
  teamId: string;
  repoId: bigint;
  repoFullName: string;
}): Promise<boolean> {
  try {
    return await db.$transaction(async (tx) => {
      await lockForWrite({
        tx,
        kind: REPO_CLAIM_LOCK,
        id: repoFullName.toLowerCase(),
      });
      // By id too: the verified team may have the repository under the name
      // it had before a rename (#11).
      const other = await tx.team.findFirst({
        where: {
          id: { not: teamId },
          ...VERIFIED_REPO,
          OR: [{ repoId }, { repoFullName: sameRepoName(repoFullName) }],
        },
        select: { id: true },
      });
      if (other !== null) return false;
      await tx.team.updateMany({
        where: { id: teamId, repoVerifiedAt: null },
        data: {
          repoVerifiedAt: new Date(),
          repoId,
          canUseServerWebhookSecret: false,
        },
      });
      return true;
    });
  } catch (error) {
    // A unique index caught a verification that got past the check without
    // taking the lock: at most one verified team per repository name,
    // ignoring case, and one team per repository id.
    if (isUniqueViolation(error)) return false;
    throw error;
  }
}

// For Settings: "Waiting for GitHub's ping" until the team is verified,
// "Connected" after (decision 007, #117).
export async function isTeamRepoVerified({
  teamId,
}: {
  teamId: string;
}): Promise<boolean> {
  const team = await db.team.findUnique({
    where: { id: teamId },
    select: { repoVerifiedAt: true },
  });
  return team !== null && team.repoVerifiedAt !== null;
}

// GitHub's repository id finds the team after a rename (#11). Stored by the
// ping that verifies the team; a team that already has one keeps it.
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
