import type { TeamRole } from "@/lib/auth/team-access";
import { db } from "@/server/db";

export async function findMembershipRole({
  userId,
  teamId,
}: {
  userId: string;
  teamId: string;
}) {
  return db.membership.findUnique({
    where: { userId_teamId: { userId, teamId } },
    select: { role: true },
  });
}

// An existing membership keeps its role: opening a link never changes it.
export async function joinTeam({
  userId,
  teamId,
  role,
}: {
  userId: string;
  teamId: string;
  role: TeamRole;
}) {
  // ON CONFLICT DO NOTHING, so two clicks at once still add one row.
  const { count } = await db.membership.createMany({
    data: [{ userId, teamId, role }],
    skipDuplicates: true,
  });
  const membership = await db.membership.findUniqueOrThrow({
    where: { userId_teamId: { userId, teamId } },
    select: { role: true },
  });
  return { role: membership.role, isNew: count === 1 };
}

export async function listTeamMembers({ teamId }: { teamId: string }) {
  return db.membership.findMany({
    where: { teamId },
    // Enum order puts LEAD first, then MEMBER, then INSTRUCTOR.
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    select: {
      role: true,
      user: {
        select: { id: true, name: true, githubLogin: true, avatarUrl: true },
      },
    },
  });
}
