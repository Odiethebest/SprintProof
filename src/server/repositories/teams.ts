import { db } from "@/server/db";
import { isUniqueViolation } from "@/server/prisma-errors";
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
  // GitHub repo names ignore case, so "odie/app" and "Odie/App" are one repo.
  const existing = await db.team.findFirst({
    where: {
      repoFullName: { equals: input.repoFullName, mode: "insensitive" },
    },
    select: { id: true },
  });
  if (existing !== null) {
    return null;
  }
  try {
    return await db.team.create({
      data: {
        ...input,
        memberships: { create: { userId: leadUserId, role: "LEAD" } },
      },
      select: TEAM_FIELDS,
    });
  } catch (error) {
    // Another request connected the same repo between the check and the insert.
    if (isUniqueViolation(error)) {
      return null;
    }
    throw error;
  }
}

export async function findTeam({ teamId }: { teamId: string }) {
  return db.team.findUnique({ where: { id: teamId }, select: TEAM_FIELDS });
}

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
      select: { id: true, repoFullName: true, repoId: true },
    });
    if (byRepoId !== null) {
      return byRepoId;
    }
  }

  const byFullName = await db.team.findFirst({
    where: {
      repoFullName: { equals: repoFullName, mode: "insensitive" },
    },
    select: { id: true, repoFullName: true, repoId: true },
  });

  if (byFullName !== null) {
    if (repoId !== undefined && repoId !== null && byFullName.repoId === null) {
      await db.team.update({
        where: { id: byFullName.id },
        data: { repoId },
      });
    }
    return byFullName;
  }

  return null;
}

export async function listTeamsForUser({ userId }: { userId: string }) {
  const memberships = await db.membership.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { role: true, team: { select: TEAM_FIELDS } },
  });
  return memberships.map(({ role, team }) => ({ ...team, role }));
}
