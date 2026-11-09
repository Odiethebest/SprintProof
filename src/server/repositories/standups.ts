import { db } from "@/server/db";
import { isUniqueViolation } from "@/server/prisma-errors";
import { toPage, type Page } from "@/lib/api/pagination";

export interface StandupRecord {
  id: string;
  sprintId: string;
  userId: string;
  date: string;
  yesterday: string;
  today: string;
  blockers: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface StandupAuthor {
  name: string | null;
  githubLogin: string | null;
  avatarUrl: string | null;
}

export interface StandupWithAuthor extends StandupRecord {
  author: StandupAuthor;
}

export interface StandupKey {
  sprintId: string;
  userId: string;
  date: string;
}

export interface SaveStandupInput extends StandupKey {
  yesterday: string;
  today: string;
  blockers: string | null;
}

const STANDUP_FIELDS = {
  id: true,
  sprintId: true,
  userId: true,
  date: true,
  yesterday: true,
  today: true,
  blockers: true,
  createdAt: true,
  updatedAt: true,
} as const;

type StandupRow = Omit<StandupRecord, "date"> & { date: Date };

// `date` is a Postgres DATE, which Prisma reads and writes as midnight UTC.
function toDbDate(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

function toStandupRecord(row: StandupRow): StandupRecord {
  return { ...row, date: row.date.toISOString().slice(0, 10) };
}

function uniqueKey({ sprintId, userId, date }: StandupKey) {
  return {
    sprintId_userId_date: { sprintId, userId, date: toDbDate(date) },
  };
}

// Rule R2: one standup per person per day, so saving again the same day updates it.
export async function saveStandup(
  input: SaveStandupInput
): Promise<{ standup: StandupRecord; isNew: boolean }> {
  const where = uniqueKey(input);
  const content = {
    yesterday: input.yesterday,
    today: input.today,
    blockers: input.blockers,
  };
  const existing = await db.standup.findUnique({
    where,
    select: { id: true },
  });
  if (existing === null) {
    // One timestamp for both, so a standup that was never changed doesn't show as edited.
    const postedAt = new Date();
    try {
      const row = await db.standup.create({
        data: {
          sprintId: input.sprintId,
          userId: input.userId,
          date: toDbDate(input.date),
          ...content,
          createdAt: postedAt,
          updatedAt: postedAt,
        },
        select: STANDUP_FIELDS,
      });
      return { standup: toStandupRecord(row), isNew: true };
    } catch (error) {
      // Another request (a double click) created it between the check and the insert.
      if (!isUniqueViolation(error)) {
        throw error;
      }
    }
  }
  const row = await db.standup.update({
    where,
    data: content,
    select: STANDUP_FIELDS,
  });
  return { standup: toStandupRecord(row), isNew: false };
}

export async function findStandup(
  key: StandupKey
): Promise<StandupRecord | null> {
  const row = await db.standup.findUnique({
    where: uniqueKey(key),
    select: STANDUP_FIELDS,
  });
  return row === null ? null : toStandupRecord(row);
}

// Newest first. The id breaks ties, so paging never skips or repeats a standup.
const HISTORY_ORDER = [
  { date: "desc" },
  { createdAt: "desc" },
  { id: "desc" },
] as const;

const STANDUP_WITH_AUTHOR_FIELDS = {
  ...STANDUP_FIELDS,
  user: { select: { name: true, githubLogin: true, avatarUrl: true } },
} as const;

function toStandupWithAuthor({
  user,
  ...row
}: StandupRow & { user: StandupAuthor }): StandupWithAuthor {
  return { ...toStandupRecord(row), author: user };
}

export async function listSprintStandups({
  sprintId,
}: {
  sprintId: string;
}): Promise<StandupWithAuthor[]> {
  const rows = await db.standup.findMany({
    where: { sprintId },
    orderBy: [...HISTORY_ORDER],
    select: STANDUP_WITH_AUTHOR_FIELDS,
  });
  return rows.map(toStandupWithAuthor);
}

// One page of a sprint's standups. Returns null when the cursor isn't one of
// this sprint's standups.
export async function listSprintStandupsPage({
  sprintId,
  limit,
  cursor,
}: {
  sprintId: string;
  limit: number;
  cursor?: string;
}): Promise<Page<StandupWithAuthor> | null> {
  if (cursor !== undefined) {
    const cursorRow = await db.standup.findFirst({
      where: { id: cursor, sprintId },
      select: { id: true },
    });
    if (cursorRow === null) {
      return null;
    }
  }
  const rows = await db.standup.findMany({
    where: { sprintId },
    orderBy: [...HISTORY_ORDER],
    take: limit + 1,
    ...(cursor === undefined ? {} : { cursor: { id: cursor }, skip: 1 }),
    select: STANDUP_WITH_AUTHOR_FIELDS,
  });
  return toPage({ rows: rows.map(toStandupWithAuthor), limit });
}
