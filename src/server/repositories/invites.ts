import { databaseTextSchema } from "@/lib/validation/text";
import { randomBytes } from "node:crypto";
import { db } from "@/server/db";
import { lockForWrite, TEAM_INVITES_LOCK } from "@/server/write-locks";
import { getInviteExpiry, type InviteRole } from "@/lib/invites/invite-link";

// 32 random bytes: 43 base64url characters, safe in a URL path.
const TOKEN_BYTES = 32;

const INVITE_FIELDS = {
  id: true,
  role: true,
  token: true,
  expiresAt: true,
} as const;

// At most one working link per team and role: a new link replaces the old one.
export async function createInvite({
  teamId,
  role,
  now,
}: {
  teamId: string;
  role: InviteRole;
  now: Date;
}) {
  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  return db.$transaction(async (tx) => {
    await lockForWrite({ tx, kind: TEAM_INVITES_LOCK, id: teamId });
    await tx.invite.updateMany({
      where: { teamId, role, revokedAt: null, expiresAt: { gt: now } },
      data: { revokedAt: now },
    });
    return tx.invite.create({
      data: {
        teamId,
        role,
        token,
        createdAt: now,
        expiresAt: getInviteExpiry({ createdAt: now }),
      },
      select: INVITE_FIELDS,
    });
  });
}

// Returns false when the team has no invite with this id.
export async function revokeInvite({
  teamId,
  inviteId,
  now,
}: {
  teamId: string;
  inviteId: string;
  now: Date;
}): Promise<boolean> {
  if (!databaseTextSchema.safeParse(inviteId).success) return false;
  // Scoped to the team, so a lead can't revoke another team's link by id.
  const invite = await db.invite.findFirst({
    where: { id: inviteId, teamId },
    select: { revokedAt: true },
  });
  if (invite === null) {
    return false;
  }
  if (invite.revokedAt === null) {
    await db.invite.update({
      where: { id: inviteId },
      data: { revokedAt: now },
    });
  }
  return true;
}

export async function findInviteByToken({ token }: { token: string }) {
  if (!databaseTextSchema.safeParse(token).success) return null;
  return db.invite.findUnique({
    where: { token },
    select: {
      teamId: true,
      role: true,
      expiresAt: true,
      revokedAt: true,
      team: { select: { name: true, repoFullName: true } },
    },
  });
}

export async function listActiveInvites({
  teamId,
  now,
}: {
  teamId: string;
  now: Date;
}) {
  return db.invite.findMany({
    where: { teamId, revokedAt: null, expiresAt: { gt: now } },
    orderBy: { createdAt: "desc" },
    select: INVITE_FIELDS,
  });
}
