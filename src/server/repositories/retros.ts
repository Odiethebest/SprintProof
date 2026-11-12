import { findNextSprint } from "@/lib/retro/next-sprint";
import type { CreateRetroItemInput } from "@/lib/retro/retro-input";
import {
  countVotesLeft,
  decideVote,
  selectActionItems,
  sortRetroItems,
  type RetroColumn,
  type RetroVoteInput,
} from "@/lib/retro/retro-votes";
import { databaseTextSchema } from "@/lib/validation/text";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { isUniqueViolation } from "@/server/prisma-errors";
import { SPRINT_RETRO_LOCK, lockForWrite } from "@/server/write-locks";

export interface RetroAuthor {
  userId: string;
  name: string | null;
  githubLogin: string | null;
}

export interface RetroItemRecord {
  id: string;
  column: RetroColumn;
  text: string;
  createdAt: Date;
  author: RetroAuthor;
}

// An action item made from one of this retro's "To improve" items when it
// closed. Its text and votes are the item's.
export interface MadeActionItemRecord {
  id: string;
  sprintId: string;
  retroItemId: string;
  isDone: boolean;
}

export interface RetroRecord {
  id: string;
  sprintId: string;
  // null while the retro is open.
  closedAt: Date | null;
  createdAt: Date;
  items: RetroItemRecord[];
  votes: RetroVoteInput[];
  actionItems: MadeActionItemRecord[];
}

// An action item carried into a sprint from the previous sprint's retro.
export interface CarriedActionItemRecord {
  id: string;
  sprintId: string;
  retroItemId: string;
  text: string;
  voteCount: number;
  isDone: boolean;
  // The retro item's creation time, which breaks vote ties (rule R6).
  createdAt: Date;
  // The sprint whose retro it came from.
  fromSprintName: string;
}

export type RetroWriteFailure = "RETRO_NOT_FOUND" | "RETRO_CLOSED";

export type AddRetroItemResult =
  { status: "ADDED"; item: RetroItemRecord } | { status: RetroWriteFailure };

export type SetRetroVoteResult =
  | {
      status: "SAVED";
      voteCount: number;
      hasVoted: boolean;
      votesLeft: number;
    }
  | { status: RetroWriteFailure | "ITEM_NOT_FOUND" | "NO_VOTES_LEFT" };

export type CloseRetroResult =
  | { status: "CLOSED"; retro: RetroRecord }
  | { status: RetroWriteFailure | "NO_NEXT_SPRINT" };

export type SetActionItemDoneResult =
  | { status: "SAVED"; actionItem: CarriedActionItemRecord }
  | { status: "ACTION_ITEM_NOT_FOUND" | "RETRO_CLOSED" };

const ITEM_FIELDS = {
  id: true,
  column: true,
  text: true,
  createdAt: true,
  author: { select: { id: true, name: true, githubLogin: true } },
} as const;

type ItemRow = Prisma.RetroItemGetPayload<{ select: typeof ITEM_FIELDS }>;

function toItemRecord(row: ItemRow): RetroItemRecord {
  return {
    id: row.id,
    column: row.column,
    text: row.text,
    createdAt: row.createdAt,
    author: {
      userId: row.author.id,
      name: row.author.name,
      githubLogin: row.author.githubLogin,
    },
  };
}

const CARRIED_FIELDS = {
  id: true,
  sprintId: true,
  retroItemId: true,
  isDone: true,
  retroItem: {
    select: {
      text: true,
      createdAt: true,
      _count: { select: { votes: true } },
      retro: { select: { sprint: { select: { name: true } } } },
    },
  },
} as const;

type CarriedRow = Prisma.ActionItemGetPayload<{
  select: typeof CARRIED_FIELDS;
}>;

function toCarriedRecord(row: CarriedRow): CarriedActionItemRecord {
  return {
    id: row.id,
    sprintId: row.sprintId,
    retroItemId: row.retroItemId,
    text: row.retroItem.text,
    voteCount: row.retroItem._count.votes,
    isDone: row.isDone,
    createdAt: row.retroItem.createdAt,
    fromSprintName: row.retroItem.retro.sprint.name,
  };
}

// Every write to a sprint's retro and its carried action items checks the
// retro first, so it takes this lock (AGENTS.md Key patterns): writes to one
// retro happen one at a time, a member's votes can't pass 3 by racing each
// other, and nothing changes between a closing retro's count and its closedAt.
// Returns the retro as it is under the lock, or null when the sprint has none.
async function lockRetro(
  tx: Prisma.TransactionClient,
  sprintId: string
): Promise<{ id: string; closedAt: Date | null } | null> {
  await lockForWrite({ tx, kind: SPRINT_RETRO_LOCK, id: sprintId });
  return tx.retro.findUnique({
    where: { sprintId },
    select: { id: true, closedAt: true },
  });
}

// The sprint's retro with its items, votes and the action items it made, or
// null before the lead opens it.
export async function findRetro({
  sprintId,
}: {
  sprintId: string;
}): Promise<RetroRecord | null> {
  if (!databaseTextSchema.safeParse(sprintId).success) return null;
  const retro = await db.retro.findUnique({
    where: { sprintId },
    select: {
      id: true,
      sprintId: true,
      closedAt: true,
      createdAt: true,
      items: { select: ITEM_FIELDS, orderBy: { createdAt: "asc" } },
    },
  });
  if (retro === null) return null;
  const [votes, actionItems] = await Promise.all([
    db.retroVote.findMany({
      where: { item: { retroId: retro.id } },
      select: { itemId: true, userId: true },
    }),
    db.actionItem.findMany({
      where: { retroItem: { retroId: retro.id } },
      select: { id: true, sprintId: true, retroItemId: true, isDone: true },
    }),
  ]);
  return {
    ...retro,
    items: retro.items.map(toItemRecord),
    votes,
    actionItems,
  };
}

// Opens the sprint's retro. Returns null when it already has one, so two
// clicks at once open one retro.
export async function openRetro({
  sprintId,
}: {
  sprintId: string;
}): Promise<RetroRecord | null> {
  try {
    await db.retro.create({ data: { sprintId } });
  } catch (error) {
    if (isUniqueViolation(error)) return null;
    throw error;
  }
  return findRetro({ sprintId });
}

export async function addRetroItem({
  sprintId,
  authorId,
  column,
  text,
}: CreateRetroItemInput & {
  sprintId: string;
  authorId: string;
}): Promise<AddRetroItemResult> {
  return db.$transaction(async (tx) => {
    const retro = await lockRetro(tx, sprintId);
    if (retro === null) return { status: "RETRO_NOT_FOUND" };
    if (retro.closedAt !== null) return { status: "RETRO_CLOSED" };
    const row = await tx.retroItem.create({
      data: { retroId: retro.id, authorId, column, text },
      select: ITEM_FIELDS,
    });
    return { status: "ADDED", item: toItemRecord(row) };
  });
}

// Adds the member's vote on an item (isVoting) or takes it back: 3 votes per
// retro, at most 1 per item (rule R6).
export async function setRetroVote({
  sprintId,
  itemId,
  userId,
  isVoting,
}: {
  sprintId: string;
  itemId: string;
  userId: string;
  isVoting: boolean;
}): Promise<SetRetroVoteResult> {
  if (!databaseTextSchema.safeParse(itemId).success) {
    return { status: "ITEM_NOT_FOUND" };
  }
  return db.$transaction(async (tx) => {
    const retro = await lockRetro(tx, sprintId);
    if (retro === null) return { status: "RETRO_NOT_FOUND" };
    if (retro.closedAt !== null) return { status: "RETRO_CLOSED" };
    const item = await tx.retroItem.findFirst({
      where: { id: itemId, retroId: retro.id },
      select: { id: true },
    });
    if (item === null) return { status: "ITEM_NOT_FOUND" };
    const ownVotes = await tx.retroVote.findMany({
      where: { userId, item: { retroId: retro.id } },
      select: { itemId: true, userId: true },
    });
    const decision = decideVote({
      votes: ownVotes,
      voterId: userId,
      itemId,
      isVoting,
    });
    if (decision === "NO_VOTES_LEFT") return { status: "NO_VOTES_LEFT" };
    if (decision === "ADD") {
      await tx.retroVote.create({ data: { itemId, userId } });
    }
    if (decision === "REMOVE") {
      await tx.retroVote.deleteMany({ where: { itemId, userId } });
    }
    const votesNow = await tx.retroVote.findMany({
      where: { item: { retroId: retro.id } },
      select: { itemId: true, userId: true },
    });
    return {
      status: "SAVED",
      voteCount: votesNow.filter((vote) => vote.itemId === itemId).length,
      hasVoted: votesNow.some(
        (vote) => vote.itemId === itemId && vote.userId === userId
      ),
      votesLeft: countVotesLeft({ votes: votesNow, voterId: userId }),
    };
  });
}

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// Closes the retro and carries its top 3 "To improve" items into the sprint
// that starts next (rule R6). With no later sprint the retro stays open, since
// its action items would have nowhere to go.
export async function closeRetro({
  teamId,
  sprintId,
  closedAt,
}: {
  teamId: string;
  sprintId: string;
  closedAt: Date;
}): Promise<CloseRetroResult> {
  const failure = await db.$transaction(
    async (tx): Promise<CloseRetroResult | null> => {
      const retro = await lockRetro(tx, sprintId);
      if (retro === null) return { status: "RETRO_NOT_FOUND" };
      if (retro.closedAt !== null) return { status: "RETRO_CLOSED" };
      const sprints = (
        await tx.sprint.findMany({
          where: { teamId },
          select: { id: true, startDate: true },
        })
      ).map((row) => ({ id: row.id, startDate: toDateString(row.startDate) }));
      const sprint = sprints.find((row) => row.id === sprintId);
      const next =
        sprint === undefined ? null : findNextSprint({ sprint, sprints });
      if (next === null) return { status: "NO_NEXT_SPRINT" };
      const [items, votes] = await Promise.all([
        tx.retroItem.findMany({
          where: { retroId: retro.id },
          select: { id: true, column: true, createdAt: true },
        }),
        tx.retroVote.findMany({
          where: { item: { retroId: retro.id } },
          select: { itemId: true, userId: true },
        }),
      ]);
      await tx.actionItem.createMany({
        data: selectActionItems({ items, votes }).map((item) => ({
          sprintId: next.id,
          retroItemId: item.id,
        })),
      });
      await tx.retro.update({ where: { id: retro.id }, data: { closedAt } });
      return null;
    }
  );
  if (failure !== null) return failure;
  const retro = await findRetro({ sprintId });
  if (retro === null) return { status: "RETRO_NOT_FOUND" };
  return { status: "CLOSED", retro };
}

// The action items carried into this sprint, in vote order as they were picked.
export async function listCarriedActionItems({
  sprintId,
}: {
  sprintId: string;
}): Promise<CarriedActionItemRecord[]> {
  if (!databaseTextSchema.safeParse(sprintId).success) return [];
  const rows = await db.actionItem.findMany({
    where: { sprintId },
    select: CARRIED_FIELDS,
  });
  return sortRetroItems({ items: rows.map(toCarriedRecord) });
}

// Checks an action item carried into this sprint off, or unchecks it. Once
// this sprint's own retro closes, its record doesn't change.
export async function setActionItemDone({
  sprintId,
  actionItemId,
  isDone,
}: {
  sprintId: string;
  actionItemId: string;
  isDone: boolean;
}): Promise<SetActionItemDoneResult> {
  if (!databaseTextSchema.safeParse(actionItemId).success) {
    return { status: "ACTION_ITEM_NOT_FOUND" };
  }
  return db.$transaction(async (tx) => {
    const retro = await lockRetro(tx, sprintId);
    const actionItem = await tx.actionItem.findFirst({
      where: { id: actionItemId, sprintId },
      select: { id: true },
    });
    if (actionItem === null) return { status: "ACTION_ITEM_NOT_FOUND" };
    if (retro !== null && retro.closedAt !== null) {
      return { status: "RETRO_CLOSED" };
    }
    const row = await tx.actionItem.update({
      where: { id: actionItem.id },
      data: { isDone },
      select: CARRIED_FIELDS,
    });
    return { status: "SAVED", actionItem: toCarriedRecord(row) };
  });
}
