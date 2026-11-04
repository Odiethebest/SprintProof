import { db } from "@/server/db";

export async function findMembershipRole({
  userId,
  teamId,
}: {
  userId: string;
  teamId: string;
}) {
  return db.membership.findUnique({
    where: { userId_teamId: { userId, teamId } },
    select: { role: true },
  });
}
