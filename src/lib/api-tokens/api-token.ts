import crypto from "node:crypto";

// Every token starts with this, so a leaked one is easy to spot in logs and
// secret scanners.
export const API_TOKEN_PREFIX = "spk_live_";
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
