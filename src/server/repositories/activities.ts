import { db } from "@/server/db";
import type { MappedActivity } from "@/lib/github/webhook-events";
import type { ActivityRecord } from "@/lib/stats/member-activity";

// Compares code units, not locale rules, so every server sorts the same way.
// A row without a SHA never conflicts, so where it goes doesn't matter.
function compareBySha(
  left: { sha: string | null },
  right: { sha: string | null }
): number {
  const a = left.sha ?? "";
  const b = right.sha ?? "";
  if (a === b) {
    return 0;
  }
  return a < b ? -1 : 1;
}

export async function recordWebhookEvent({
  teamId,
  event,
  deliveryId,
  activities,
}: {
  teamId: string | null;
  event: string;
  deliveryId: string;
  activities: MappedActivity[];
}): Promise<{ alreadyProcessed: boolean; activitiesCreated: number }> {
  return db.$transaction(async (tx) => {
    const delivery = await tx.webhookDelivery.createMany({
      data: [{ id: deliveryId, teamId, event }],
      skipDuplicates: true,
    });
    if (delivery.count === 0) {
      return { alreadyProcessed: true, activitiesCreated: 0 };
    }
    if (teamId === null || activities.length === 0) {
      return { alreadyProcessed: false, activitiesCreated: 0 };
    }
    const data = activities.map((activity) => ({
      teamId,
      type: activity.type,
      actorLogin: activity.actorLogin,
      prNumber: activity.prNumber,
      prAuthorLogin: activity.prAuthorLogin,
      sha: activity.sha,
      title: activity.title,
      occurredAt: activity.occurredAt,
    }));
    // Counting rule: commits deduplicate by SHA, across deliveries (AGENTS.md §1).
    // Inserted in SHA order, so two deliveries that share commits wait for each
    // other's rows in the same order. In payload order, each could wait on a
    // row the other inserted first, and PostgreSQL aborts one as a deadlock (#90).
    const commits = data
      .filter((activity) => activity.type === "COMMIT")
      .sort(compareBySha);
    const other = data.filter((activity) => activity.type !== "COMMIT");
    const insertedCommits = commits.length
      ? await tx.activity.createMany({ data: commits, skipDuplicates: true })
      : { count: 0 };
    const insertedOther = other.length
      ? await tx.activity.createMany({ data: other })
      : { count: 0 };
    return {
      alreadyProcessed: false,
      activitiesCreated: insertedCommits.count + insertedOther.count,
    };
  });
}

export async function getLastWebhookDelivery({ teamId }: { teamId: string }) {
  return db.webhookDelivery.findFirst({
    where: { teamId },
    orderBy: { deliveredAt: "desc" },
    select: {
      id: true,
      event: true,
      deliveredAt: true,
    },
  });
}

// Activities that happened between `from` and `to` (inclusive), newest first.
export async function listTeamActivities({
  teamId,
  from,
  to,
}: {
  teamId: string;
  from: Date;
  to: Date;
}): Promise<ActivityRecord[]> {
  return db.activity.findMany({
    where: { teamId, occurredAt: { gte: from, lte: to } },
    orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      type: true,
      actorLogin: true,
      prNumber: true,
      prAuthorLogin: true,
      sha: true,
      title: true,
      occurredAt: true,
    },
  });
}
