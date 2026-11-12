import crypto from "node:crypto";
import {
  expect,
  type APIRequestContext,
  type APIResponse,
  type Page,
} from "@playwright/test";

// The server-wide GITHUB_WEBHOOK_SECRET that playwright.config.ts and the e2e
// job in ci.yml give the web server. It isn't a real secret. Teams created
// after #115 never accept it, so the specs use it only to show that.
export const SERVER_WEBHOOK_SECRET =
  process.env.GITHUB_WEBHOOK_SECRET ?? "e2e-webhook-secret-not-a-real-secret";

// Sends a delivery the way GitHub does: the raw JSON body, signed with
// HMAC-SHA256 under the webhook secret, plus the event and delivery headers.
export function deliverWebhook(
  request: APIRequestContext,
  delivery: {
    secret: string;
    event: string;
    deliveryId: string;
    payload: unknown;
  }
): Promise<APIResponse> {
  const body = JSON.stringify(delivery.payload);
  const signature = crypto
    .createHmac("sha256", delivery.secret)
    .update(body)
    .digest("hex");
  return request.post("/api/webhooks/github", {
    data: body,
    headers: {
      "content-type": "application/json",
      "x-github-event": delivery.event,
      "x-github-delivery": delivery.deliveryId,
      "x-hub-signature-256": `sha256=${signature}`,
    },
  });
}

// Copies the team's webhook secret the way a lead does before pasting it into
// GitHub: "Copy webhook secret" in Settings → Repository (#115).
export async function copyWebhookSecret(
  page: Page,
  teamId: string
): Promise<string> {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(`/teams/${teamId}/settings`);
  await page
    .getByRole("region", { name: "Repository" })
    .getByRole("button", { name: "Copy webhook secret" })
    .click();
  await expect(
    page.getByRole("button", { name: "Copied webhook secret" })
  ).toBeVisible();
  const secret = await page.evaluate(() => navigator.clipboard.readText());
  expect(secret).toMatch(/^[0-9a-f]{64}$/);
  return secret;
}
