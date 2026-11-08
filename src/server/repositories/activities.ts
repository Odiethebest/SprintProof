import { db } from "@/server/db";
import { isUniqueViolation } from "@/server/prisma-errors";
import type { MappedActivity } from "@/lib/github/webhook-events";
import type { ActivityRecord } from "@/lib/stats/member-activity";

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
  const existing = await db.webhookDelivery.findUnique({
    where: { id: deliveryId },
    select: { id: true },
  });
  if (existing !== null) {
    return { alreadyProcessed: true, activitiesCreated: 0 };
  }

  try {
    return await db.$transaction(async (tx) => {
      await tx.webhookDelivery.create({
        data: {
          id: deliveryId,
          teamId,
          event,
        },
      });

      if (teamId !== null && activities.length > 0) {
        for (const activity of activities) {
          if (activity.type === "COMMIT" && activity.sha) {
            await tx.activity.upsert({
              where: {
                teamId_type_sha: {
                  teamId,
                  type: "COMMIT",
                  sha: activity.sha,
                },
              },
              create: {
                teamId,
                type: activity.type,
                actorLogin: activity.actorLogin,
                prNumber: activity.prNumber,
                prAuthorLogin: activity.prAuthorLogin,
                sha: activity.sha,
                title: activity.title,
                occurredAt: activity.occurredAt,
              },
              update: {},
            });
          } else {
            await tx.activity.create({
              data: {
                teamId,
                type: activity.type,
                actorLogin: activity.actorLogin,
                prNumber: activity.prNumber,
                prAuthorLogin: activity.prAuthorLogin,
                sha: activity.sha,
                title: activity.title,
                occurredAt: activity.occurredAt,
              },
            });
          }
        }
      }

      return { alreadyProcessed: false, activitiesCreated: activities.length };
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { alreadyProcessed: true, activitiesCreated: 0 };
    }
    throw error;
  }
}

export async function getLastWebhookDelivery({
  teamId,
}: {
  teamId: string;
}) {
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
