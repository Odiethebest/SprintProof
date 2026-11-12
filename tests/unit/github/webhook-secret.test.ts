import { describe, expect, it } from "vitest";
import { toWebhookSecretLast4 } from "@/lib/github/webhook-secret";

// Settings and the rotate endpoint show only the end of a team's webhook
// secret, so the lead can tell secrets apart (#115).
describe("toWebhookSecretLast4", () => {
  it("returns the secret's last 4 characters", () => {
    expect(
      toWebhookSecretLast4({
        webhookSecret:
          "4f9c2e7a1b3d5f6e8a0c2e4f6a8b0d2e4f6a8c0e2a4c6e8a0b2d4f6a8c0e3f9a",
      })
    ).toBe("3f9a");
  });
});
