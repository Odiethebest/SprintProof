import { db } from "@/server/db";
import type { SprintRecord } from "@/lib/sprints";

export interface CreateSprintInput {
  teamId: string;
  name: string;
  startDate: string;
  endDate: string;
  standupsPerPerson: number;
  reviewsPerPerson: number;
}

export interface UpdateSprintInput {
  teamId: string;
  sprintId: string;
  name: string;
  startDate: string;
  endDate: string;
  standupsPerPerson: number;
  reviewsPerPerson: number;
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

export async function createSprint(
  input: CreateSprintInput
): Promise<SprintRecord> {
  const row = await db.sprint.create({
    data: {
      teamId: input.teamId,
      name: input.name,
      startDate: parseDbDate(input.startDate),
      endDate: parseDbDate(input.endDate),
      standupsPerPerson: input.standupsPerPerson,
      reviewsPerPerson: input.reviewsPerPerson,
    },
    select: SPRINT_FIELDS,
  });
  return toSprintRecord(row);
}

export async function findSprintById({
  teamId,
  sprintId,
}: {
  teamId: string;
  sprintId: string;
}): Promise<SprintRecord | null> {
  const row = await db.sprint.findFirst({
    where: { id: sprintId, teamId },
    select: SPRINT_FIELDS,
  });
  return row ? toSprintRecord(row) : null;
}

export async function updateSprint(
  input: UpdateSprintInput
): Promise<SprintRecord | null> {
  const existing = await db.sprint.findFirst({
    where: { id: input.sprintId, teamId: input.teamId },
    select: { id: true },
  });
  if (existing === null) {
    return null;
  }
  const row = await db.sprint.update({
    where: { id: input.sprintId },
    data: {
      name: input.name,
      startDate: parseDbDate(input.startDate),
      endDate: parseDbDate(input.endDate),
      standupsPerPerson: input.standupsPerPerson,
      reviewsPerPerson: input.reviewsPerPerson,
    },
    select: SPRINT_FIELDS,
  });
  return toSprintRecord(row);
}
