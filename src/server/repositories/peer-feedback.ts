import { toPage, type Page } from "@/lib/api/pagination";
import { databaseTextSchema } from "@/lib/validation/text";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { lockRetro } from "@/server/repositories/retros";

// Partner feedback (#14). Rule R7: only the team's instructors read it. These
// functions are the only reads of the table, and each one is limited on its
// own: an instructor check, or the author's own entries. Nothing here returns
// feedback to anyone else, whatever a route or page asks for.

export interface PeerFeedbackPerson {
  userId: string;
  name: string | null;
  githubLogin: string | null;
}

export interface PeerFeedbackRecord {
  id: string;
  sprintId: string;
  author: PeerFeedbackPerson;
  recipient: PeerFeedbackPerson;
  text: string;
  createdAt: Date;
  updatedAt: Date;
}

export type SavePeerFeedbackResult =
  | { status: "SAVED"; feedback: PeerFeedbackRecord }
  | { status: "RETRO_NOT_FOUND" | "RETRO_CLOSED" | "TEAMMATE_NOT_FOUND" };

export type PeerFeedbackPageResult =
  | { status: "LISTED"; page: Page<PeerFeedbackRecord> }
  | { status: "NOT_INSTRUCTOR" }
  | { status: "INVALID_CURSOR" };

const PERSON_FIELDS = { id: true, name: true, githubLogin: true } as const;

const FEEDBACK_FIELDS = {
  id: true,
  sprintId: true,
  text: true,
  createdAt: true,
  updatedAt: true,
  author: { select: PERSON_FIELDS },
  recipient: { select: PERSON_FIELDS },
} as const;

type FeedbackRow = Prisma.PeerFeedbackGetPayload<{
  select: typeof FEEDBACK_FIELDS;
}>;

// Oldest first; the id breaks ties so pages never skip or repeat an entry.
const FEEDBACK_ORDER = [{ createdAt: "asc" }, { id: "asc" }] as const;

function toPerson(row: FeedbackRow["author"]): PeerFeedbackPerson {
  return { userId: row.id, name: row.name, githubLogin: row.githubLogin };
}

function toRecord(row: FeedbackRow): PeerFeedbackRecord {
  return {
    id: row.id,
    sprintId: row.sprintId,
    author: toPerson(row.author),
    recipient: toPerson(row.recipient),
    text: row.text,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function isValidId(id: string): boolean {
  return databaseTextSchema.safeParse(id).success;
}

async function isTeamInstructor({
  teamId,
  userId,
}: {
  teamId: string;
  userId: string;
}): Promise<boolean> {
  if (!isValidId(teamId)) return false;
  const membership = await db.membership.findUnique({
    where: { userId_teamId: { userId, teamId } },
    select: { role: true },
  });
  return membership?.role === "INSTRUCTOR";
}

// The sprint's feedback, but only when the sprint is the team's.
function teamSprintWhere({
  teamId,
  sprintId,
}: {
  teamId: string;
  sprintId: string;
}): Prisma.PeerFeedbackWhereInput {
  return { sprintId, sprint: { teamId } };
}

// Every entry of the team's sprint, oldest first, for the review page and the
// instructor's export. null unless `instructorId` is an instructor on the
// team (rule R7), so a lead, a member or another team's instructor gets
// nothing back, not even an empty list.
export async function listPeerFeedbackForInstructor({
  teamId,
  sprintId,
  instructorId,
}: {
  teamId: string;
  sprintId: string;
  instructorId: string;
}): Promise<PeerFeedbackRecord[] | null> {
  if (!(await isTeamInstructor({ teamId, userId: instructorId }))) return null;
  if (!isValidId(sprintId)) return [];
  const rows = await db.peerFeedback.findMany({
    where: teamSprintWhere({ teamId, sprintId }),
    orderBy: [...FEEDBACK_ORDER],
    select: FEEDBACK_FIELDS,
  });
  return rows.map(toRecord);
}

// One page of the same list, for GET .../peer-feedback.
export async function listPeerFeedbackPageForInstructor({
  teamId,
  sprintId,
  instructorId,
  limit,
  cursor,
}: {
  teamId: string;
  sprintId: string;
  instructorId: string;
  limit: number;
  cursor?: string;
}): Promise<PeerFeedbackPageResult> {
  if (!(await isTeamInstructor({ teamId, userId: instructorId }))) {
    return { status: "NOT_INSTRUCTOR" };
  }
  if (!isValidId(sprintId)) {
    return { status: "LISTED", page: { data: [], nextCursor: null } };
  }
  const where = teamSprintWhere({ teamId, sprintId });
  if (cursor !== undefined) {
    const cursorRow = await db.peerFeedback.findFirst({
      where: { id: cursor, ...where },
      select: { id: true },
    });
    if (cursorRow === null) return { status: "INVALID_CURSOR" };
  }
  const rows = await db.peerFeedback.findMany({
    where,
    orderBy: [...FEEDBACK_ORDER],
    take: limit + 1,
    ...(cursor === undefined ? {} : { cursor: { id: cursor }, skip: 1 }),
    select: FEEDBACK_FIELDS,
  });
  return {
    status: "LISTED",
    page: toPage({ rows: rows.map(toRecord), limit }),
  };
}

// What the author wrote in this sprint, so the retro form can show it back to
// them for editing. Filtered by author, so it never holds what a teammate
// wrote about them.
export async function listOwnPeerFeedback({
  sprintId,
  authorId,
}: {
  sprintId: string;
  authorId: string;
}): Promise<PeerFeedbackRecord[]> {
  if (!isValidId(sprintId)) return [];
  const rows = await db.peerFeedback.findMany({
    where: { sprintId, authorId },
    orderBy: [...FEEDBACK_ORDER],
    select: FEEDBACK_FIELDS,
  });
  return rows.map(toRecord);
}

// Saves the author's feedback about one teammate, replacing what they saved
// before: one entry per author, teammate and sprint. Only while the sprint's
// retro is open, under the retro's lock, so closing it and saving feedback
// happen one after the other.
export async function savePeerFeedback({
  teamId,
  sprintId,
  authorId,
  recipientId,
  text,
}: {
  teamId: string;
  sprintId: string;
  authorId: string;
  recipientId: string;
  text: string;
}): Promise<SavePeerFeedbackResult> {
  return db.$transaction(async (tx) => {
    const retro = await lockRetro(tx, sprintId);
    if (retro === null) return { status: "RETRO_NOT_FOUND" };
    if (retro.closedAt !== null) return { status: "RETRO_CLOSED" };
    if (recipientId === authorId || !isValidId(recipientId)) {
      return { status: "TEAMMATE_NOT_FOUND" };
    }
    // A teammate is another lead or member; instructors aren't reviewed.
    const teammate = await tx.membership.findFirst({
      where: {
        teamId,
        userId: recipientId,
        role: { in: ["LEAD", "MEMBER"] },
      },
      select: { id: true },
    });
    if (teammate === null) return { status: "TEAMMATE_NOT_FOUND" };
    const row = await tx.peerFeedback.upsert({
      where: {
        sprintId_authorId_recipientId: { sprintId, authorId, recipientId },
      },
      create: { sprintId, authorId, recipientId, text },
      update: { text },
      select: FEEDBACK_FIELDS,
    });
    return { status: "SAVED", feedback: toRecord(row) };
  });
}
