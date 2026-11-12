import { databaseTextSchema } from "@/lib/validation/text";
import { db } from "@/server/db";
import { lockForWrite, TEAM_SPRINTS_LOCK } from "@/server/write-locks";
import { toPage, type Page } from "@/lib/api/pagination";
import {
  validateSprint,
  type SprintRecord,
  type SprintInput,
} from "@/lib/sprints";

export interface CreateSprintInput {
  teamId: string;
  name: string;
  startDate: string;
  endDate: string;
  standupsPerPerson: number;
  reviewsPerPerson: number;
}

export type UpdateSprintInput = Pick<CreateSprintInput, "teamId"> & {
  sprintId: string;
} & Partial<Omit<CreateSprintInput, "teamId">>;

export class SprintValidationFailure extends Error {}

function assertValidSprint(
  sprint: SprintInput,
  existingSprints: SprintRecord[]
) {
  const errors = validateSprint({ sprint, existingSprints });
  if (errors.length > 0) throw new SprintValidationFailure(errors[0].message);
}

const SPRINT_FIELDS = {
  id: true,
  teamId: true,
  name: true,
  startDate: true,
  endDate: true,
  standupsPerPerson: true,
  reviewsPerPerson: true,
  createdAt: true,
  updatedAt: true,
} as const;

type SprintRow = {
  id: string;
  teamId: string;
  name: string;
  startDate: Date;
  endDate: Date;
  standupsPerPerson: number;
  reviewsPerPerson: number;
  createdAt: Date;
  updatedAt: Date;
};

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseDbDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

function toSprintRecord(row: SprintRow): SprintRecord {
  return {
    id: row.id,
    teamId: row.teamId,
    name: row.name,
    startDate: formatDate(row.startDate),
    endDate: formatDate(row.endDate),
    standupsPerPerson: row.standupsPerPerson,
    reviewsPerPerson: row.reviewsPerPerson,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listSprints({
  teamId,
}: {
  teamId: string;
}): Promise<SprintRecord[]> {
  const rows = await db.sprint.findMany({
    where: { teamId },
    orderBy: [{ startDate: "asc" }, { createdAt: "asc" }],
    select: SPRINT_FIELDS,
  });
  return rows.map(toSprintRecord);
}

// Oldest first, as listSprints() orders them; the id breaks ties so every
// sprint lands on exactly one page.
const SPRINT_PAGE_ORDER = [
  { startDate: "asc" },
  { createdAt: "asc" },
  { id: "asc" },
] as const;

// One page of a team's sprints. Returns null when the cursor isn't one of this
// team's sprints, so a client can't page through another team's list.
export async function listSprintsPage({
  teamId,
  limit,
  cursor,
}: {
  teamId: string;
  limit: number;
  cursor?: string;
}): Promise<Page<SprintRecord> | null> {
  if (cursor !== undefined) {
    const cursorRow = await db.sprint.findFirst({
      where: { id: cursor, teamId },
      select: { id: true },
    });
    if (cursorRow === null) {
      return null;
    }
  }
  const rows = await db.sprint.findMany({
    where: { teamId },
    orderBy: [...SPRINT_PAGE_ORDER],
    take: limit + 1,
    ...(cursor === undefined ? {} : { cursor: { id: cursor }, skip: 1 }),
    select: SPRINT_FIELDS,
  });
  return toPage({ rows: rows.map(toSprintRecord), limit });
}

export async function createSprint(
  input: CreateSprintInput
): Promise<SprintRecord> {
  return db.$transaction(async (tx) => {
    await lockForWrite({ tx, kind: TEAM_SPRINTS_LOCK, id: input.teamId });
    const existing = await tx.sprint.findMany({
      where: { teamId: input.teamId },
      select: SPRINT_FIELDS,
    });
    assertValidSprint(input, existing.map(toSprintRecord));
    const row = await tx.sprint.create({
      data: {
        ...input,
        startDate: parseDbDate(input.startDate),
        endDate: parseDbDate(input.endDate),
      },
      select: SPRINT_FIELDS,
    });
    return toSprintRecord(row);
  });
}

export async function findSprintById({
  teamId,
  sprintId,
}: {
  teamId: string;
  sprintId: string;
}): Promise<SprintRecord | null> {
  if (!databaseTextSchema.safeParse(sprintId).success) return null;
  const row = await db.sprint.findFirst({
    where: { id: sprintId, teamId },
    select: SPRINT_FIELDS,
  });
  return row ? toSprintRecord(row) : null;
}

export async function updateSprint(
  input: UpdateSprintInput
): Promise<SprintRecord | null> {
  return db.$transaction(async (tx) => {
    await lockForWrite({ tx, kind: TEAM_SPRINTS_LOCK, id: input.teamId });
    const rows = await tx.sprint.findMany({
      where: { teamId: input.teamId },
      select: SPRINT_FIELDS,
    });
    const existing = rows.find((row) => row.id === input.sprintId);
    if (existing === undefined) return null;
    // Merge partial edits only after acquiring the lock, to keep concurrent changes.
    const sprint: SprintInput = {
      id: input.sprintId,
      name: input.name ?? existing.name,
      startDate: input.startDate ?? formatDate(existing.startDate),
      endDate: input.endDate ?? formatDate(existing.endDate),
      standupsPerPerson: input.standupsPerPerson ?? existing.standupsPerPerson,
      reviewsPerPerson: input.reviewsPerPerson ?? existing.reviewsPerPerson,
    };
    assertValidSprint(sprint, rows.map(toSprintRecord));
    const row = await tx.sprint.update({
      where: { id: input.sprintId },
      data: {
        name: sprint.name,
        startDate: parseDbDate(sprint.startDate),
        endDate: parseDbDate(sprint.endDate),
        standupsPerPerson: sprint.standupsPerPerson,
        reviewsPerPerson: sprint.reviewsPerPerson,
      },
      select: SPRINT_FIELDS,
    });
    return toSprintRecord(row);
  });
}
