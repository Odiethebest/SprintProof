// Database record builders for integration tests. Not exported from ./index,
// so unit tests never import the Prisma client.
import crypto from "node:crypto";
import { db } from "@/server/db";
import type { TeamRole } from "@/lib/auth/team-access";
import type { InviteRole } from "@/lib/invites/invite-link";
import type { ActivityType, ReviewState } from "@/generated/prisma/client";

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
  overrides: {
    id?: string;
    name?: string;
    repoFullName?: string;
    timezone?: string;
    repoId?: bigint | number | null;
  } = {}
) {
  const n = recordSeq++;
  const { repoId, ...rest } = overrides;
  return db.team.create({
    data: {
      name: `Team ${n}`,
      repoFullName: `owner${n}/repo${n}`,
      repoId: repoId !== undefined && repoId !== null ? BigInt(repoId) : repoId,
      ...rest,
    },
  });
}

export async function insertMembership(input: {
  userId: string;
  teamId: string;
  role: TeamRole;
  createdAt?: Date;
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

export async function insertWebhookDelivery(input: {
  id: string;
  teamId?: string | null;
  event: string;
  deliveredAt?: Date;
}) {
  return db.webhookDelivery.create({
    data: input,
  });
}

export async function insertActivity(input: {
  teamId: string;
  type: ActivityType;
  actorLogin: string;
  prNumber?: number | null;
  prAuthorLogin?: string | null;
  sha?: string | null;
  title?: string | null;
  reviewState?: ReviewState | null;
  occurredAt?: Date;
}) {
  return db.activity.create({
    data: {
      occurredAt: new Date("2026-11-05T12:00:00Z"),
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

// The sprint fields the standups repository takes, from an inserted sprint.
// A standup is listed under the sprint whose dates contain its day (#56).
export function toStandupSprint(sprint: {
  id: string;
  teamId: string;
  startDate: Date;
  endDate: Date;
}) {
  return {
    id: sprint.id,
    teamId: sprint.teamId,
    startDate: sprint.startDate.toISOString().slice(0, 10),
    endDate: sprint.endDate.toISOString().slice(0, 10),
  };
}

// A standup belongs to its team and day; no sprint is stored with it (#56).
export async function insertStandup(input: {
  teamId: string;
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

// Stores a token the way the app does: the SHA-256 hash and the last 4
// characters, never the token itself. Returns the token so tests can use it.
export async function insertApiToken(input: {
  userId: string;
  name?: string;
  token?: string;
  createdAt?: Date;
  lastUsedAt?: Date | null;
}) {
  const n = recordSeq++;
  // Same length as a real token (43 characters after the prefix), with a
  // last 4 that differs per token.
  const token =
    input.token ?? `spk_live_${"x".repeat(39)}${String(n).padStart(4, "0")}`;
  const record = await db.apiToken.create({
    data: {
      userId: input.userId,
      name: input.name ?? `Token ${n}`,
      tokenHash: crypto.createHash("sha256").update(token).digest("hex"),
      last4: token.slice(-4),
      createdAt: input.createdAt,
      lastUsedAt: input.lastUsedAt ?? null,
    },
  });
  return { token, record };
}

// A sprint's retro (#13). Open unless closedAt is set.
export async function insertRetro(input: {
  sprintId: string;
  closedAt?: Date | null;
}) {
  return db.retro.create({
    data: { sprintId: input.sprintId, closedAt: input.closedAt ?? null },
  });
}

export async function insertRetroItem(input: {
  retroId: string;
  authorId: string;
  column?: "WENT_WELL" | "TO_IMPROVE";
  text?: string;
  createdAt?: Date;
}) {
  const n = recordSeq++;
  return db.retroItem.create({
    data: { column: "TO_IMPROVE", text: `Retro item ${n}`, ...input },
  });
}

export async function insertRetroVote(input: {
  itemId: string;
  userId: string;
}) {
  return db.retroVote.create({ data: input });
}

// An action item carried into `sprintId` from a closed retro's item.
export async function insertActionItem(input: {
  sprintId: string;
  retroItemId: string;
  isDone?: boolean;
}) {
  return db.actionItem.create({ data: { isDone: false, ...input } });
}

// One author's partner feedback about a teammate for a sprint (#14).
export async function insertPeerFeedback(input: {
  sprintId: string;
  authorId: string;
  recipientId: string;
  text?: string;
  createdAt?: Date;
  updatedAt?: Date;
}) {
  const n = recordSeq++;
  return db.peerFeedback.create({
    data: { text: `Peer feedback ${n}`, ...input },
  });
}
