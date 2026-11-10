import { noNul } from "@/lib/validation/text";
import crypto from "node:crypto";
import { z } from "zod";

// Every token starts with this, so a leaked one is easy to spot in logs and
// secret scanners.
export const API_TOKEN_PREFIX = "spk_live_";
export const MAX_API_TOKEN_NAME_LENGTH = 50;

const NAME_REQUIRED = "Name the token.";
const NAME_TOO_LONG = `Keep the name to ${MAX_API_TOKEN_NAME_LENGTH} characters or fewer.`;

// Shared by the tokens API and the API tokens card, so both show the same errors.
export const createApiTokenSchema = z.object({
  name: z
    .string({ error: NAME_REQUIRED })
    .trim()
    .min(1, NAME_REQUIRED)
    .max(MAX_API_TOKEN_NAME_LENGTH, NAME_TOO_LONG)
    .check(noNul),
});

export type CreateApiTokenInput = z.output<typeof createApiTokenSchema>;

// Only this hash is stored (AGENTS.md §4 Security). Tokens are long and random,
// so a plain SHA-256 is enough; a slow password hash would add nothing.
export function hashApiToken({ token }: { token: string }): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// What the database keeps of a new token: never the token itself.
export function toStoredApiToken({ token }: { token: string }): {
  tokenHash: string;
  last4: string;
} {
  return { tokenHash: hashApiToken({ token }), last4: token.slice(-4) };
}

export function maskApiToken({ last4 }: { last4: string }): string {
  return `${API_TOKEN_PREFIX}••••${last4}`;
}
