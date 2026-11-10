import { db } from "@/server/db";
import { isUniqueViolation } from "@/server/prisma-errors";
import { toPage, type Page } from "@/lib/api/pagination";
import type { SprintRecord } from "@/lib/sprints";

// The sprint a standup is listed under. A standup belongs to its team and day,
// and a sprint lists the ones whose day falls inside its dates, so standups
// follow their days when sprint dates change (#56).
export type StandupSprint = Pick<
  SprintRecord,
  "id" | "teamId" | "startDate" | "endDate"
>;

export interface StandupRecord {
  id: string;
  // The sprint it's listed under, not a stored field.
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
  sprint: StandupSprint;
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
  userId: true,
  date: true,
  yesterday: true,
  today: true,
  blockers: true,
  createdAt: true,
  updatedAt: true,
} as const;

type StandupRow = Omit<StandupRecord, "sprintId" | "date"> & { date: Date };

// `date` is a Postgres DATE, which Prisma reads and writes as midnight UTC.
function toDbDate(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

function toStandupRecord(
  row: StandupRow,
  sprint: StandupSprint
): StandupRecord {
  return {
    ...row,
    sprintId: sprint.id,
    date: row.date.toISOString().slice(0, 10),
  };
}

// The team's standups on the sprint's days, first and last day included.
function sprintStandupsWhere(sprint: StandupSprint) {
  return {
    teamId: sprint.teamId,
    date: { gte: toDbDate(sprint.startDate), lte: toDbDate(sprint.endDate) },
  };
}

function uniqueKey({ sprint, userId, date }: StandupKey) {
  return {
    teamId_userId_date: { teamId: sprint.teamId, userId, date: toDbDate(date) },
  };
}

// Rule R2: one standup per person per team per day, so saving again the same
// day updates it. `date` must be one of the sprint's days; the route picks both
// from today.
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
          teamId: input.sprint.teamId,
          userId: input.userId,
          date: toDbDate(input.date),
          ...content,
          createdAt: postedAt,
          updatedAt: postedAt,
        },
        select: STANDUP_FIELDS,
      });
      return { standup: toStandupRecord(row, input.sprint), isNew: true };
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
  return { standup: toStandupRecord(row, input.sprint), isNew: false };
}

// Returns null when the person hasn't posted that day, or the day isn't one of
// the sprint's days.
export async function findStandup({
  sprint,
  userId,
  date,
}: StandupKey): Promise<StandupRecord | null> {
  const row = await db.standup.findFirst({
    where: {
      AND: [sprintStandupsWhere(sprint), { userId, date: toDbDate(date) }],
    },
    select: STANDUP_FIELDS,
  });
  return row === null ? null : toStandupRecord(row, sprint);
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

function toStandupWithAuthor(
  { user, ...row }: StandupRow & { user: StandupAuthor },
  sprint: StandupSprint
): StandupWithAuthor {
  return { ...toStandupRecord(row, sprint), author: user };
}

export async function listSprintStandups({
  sprint,
}: {
  sprint: StandupSprint;
}): Promise<StandupWithAuthor[]> {
  const rows = await db.standup.findMany({
    where: sprintStandupsWhere(sprint),
    orderBy: [...HISTORY_ORDER],
    select: STANDUP_WITH_AUTHOR_FIELDS,
  });
  return rows.map((row) => toStandupWithAuthor(row, sprint));
}

// One page of a sprint's standups. Returns null when the cursor isn't one of
// this sprint's standups.
export async function listSprintStandupsPage({
  sprint,
  limit,
  cursor,
}: {
  sprint: StandupSprint;
  limit: number;
  cursor?: string;
}): Promise<Page<StandupWithAuthor> | null> {
  if (cursor !== undefined) {
    const cursorRow = await db.standup.findFirst({
      where: { id: cursor, ...sprintStandupsWhere(sprint) },
      select: { id: true },
    });
    if (cursorRow === null) {
      return null;
    }
  }
  const rows = await db.standup.findMany({
    where: sprintStandupsWhere(sprint),
    orderBy: [...HISTORY_ORDER],
    take: limit + 1,
    ...(cursor === undefined ? {} : { cursor: { id: cursor }, skip: 1 }),
    select: STANDUP_WITH_AUTHOR_FIELDS,
  });
  return toPage({
    rows: rows.map((row) => toStandupWithAuthor(row, sprint)),
    limit,
  });
}
