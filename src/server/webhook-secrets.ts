import { randomBytes } from "node:crypto";

// 32 random bytes as hex: 64 characters, which GitHub takes as a webhook secret.
const SECRET_BYTES = 32;

// A new team's webhook secret, or a rotated one (decision 005, #115).
// AGENTS.md §4 Security: generated with crypto.randomBytes, never logged.
export function generateWebhookSecret(): string {
  return randomBytes(SECRET_BYTES).toString("hex");
}
