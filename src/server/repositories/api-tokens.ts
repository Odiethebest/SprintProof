import { db } from "@/server/db";

// A token as Settings shows it. The hash never leaves this module.
export interface ApiTokenRecord {
  id: string;
  name: string;
  last4: string;
  createdAt: Date;
  lastUsedAt: Date | null;
}

const API_TOKEN_FIELDS = {
  id: true,
  name: true,
  last4: true,
  createdAt: true,
  lastUsedAt: true,
} as const;

export async function createApiToken(input: {
  userId: string;
  name: string;
  tokenHash: string;
  last4: string;
}): Promise<ApiTokenRecord> {
  return db.apiToken.create({ data: input, select: API_TOKEN_FIELDS });
}

export async function listApiTokens({
  userId,
}: {
  userId: string;
}): Promise<ApiTokenRecord[]> {
  return db.apiToken.findMany({
    where: { userId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: API_TOKEN_FIELDS,
  });
}

// Scoped to the owner, so no one can revoke someone else's token. Returns
// false when the user has no token with that id.
export async function deleteApiToken({
  userId,
  tokenId,
}: {
  userId: string;
  tokenId: string;
}): Promise<boolean> {
  const { count } = await db.apiToken.deleteMany({
    where: { id: tokenId, userId },
  });
  return count > 0;
}
