import { randomBytes } from "node:crypto";
import { API_TOKEN_PREFIX, toStoredApiToken } from "@/lib/api-tokens/api-token";
import {
  createApiToken,
  type ApiTokenRecord,
} from "@/server/repositories/api-tokens";

// 32 random bytes as base64url: 43 characters after the prefix.
const TOKEN_BYTES = 32;

// Creates a personal token and returns its value this one time
// (AGENTS.md §4 Security: generated with crypto.randomBytes, shown once).
export async function createPersonalApiToken({
  userId,
  name,
}: {
  userId: string;
  name: string;
}): Promise<{ apiToken: ApiTokenRecord; token: string }> {
  const token = `${API_TOKEN_PREFIX}${randomBytes(TOKEN_BYTES).toString("base64url")}`;
  const apiToken = await createApiToken({
    userId,
    name,
    ...toStoredApiToken({ token }),
  });
  return { apiToken, token };
}
