import crypto from "node:crypto";

export function verifyWebhookSignature({
  rawBody,
  signatureHeader,
  secret,
}: {
  rawBody: string;
  signatureHeader: string | null | undefined;
  secret: string;
}): boolean {
  // Anyone can compute an HMAC with an empty key, so it never proves the sender is GitHub.
  if (secret === "") {
    return false;
  }
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) {
    return false;
  }

  const providedHex = signatureHeader.slice("sha256=".length);
  const expectedHex = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  const providedBuffer = Buffer.from(providedHex, "utf8");
  const expectedBuffer = Buffer.from(expectedHex, "utf8");

  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
}

// Which secret signed a delivery: the team's own, or the server-wide
// GITHUB_WEBHOOK_SECRET.
export type WebhookSigner = "TEAM_SECRET" | "SERVER_SECRET";

// Decision 005 (#115): a delivery is checked against the secret of the team
// whose repository it names. The server-wide secret counts only for a team
// that can still use it (connected before #115 and no delivery signed with
// its own secret yet) and for a repository no team has. Returns null when
// neither secret signed the body.
export function matchWebhookSecret({
  rawBody,
  signatureHeader,
  team,
  serverSecret,
}: {
  rawBody: string;
  signatureHeader: string | null;
  team: { webhookSecret: string; canUseServerWebhookSecret: boolean } | null;
  serverSecret: string | null;
}): WebhookSigner | null {
  if (
    team !== null &&
    verifyWebhookSignature({
      rawBody,
      signatureHeader,
      secret: team.webhookSecret,
    })
  ) {
    return "TEAM_SECRET";
  }
  const canUseServerSecret = team === null || team.canUseServerWebhookSecret;
  if (
    canUseServerSecret &&
    serverSecret !== null &&
    verifyWebhookSignature({ rawBody, signatureHeader, secret: serverSecret })
  ) {
    return "SERVER_SECRET";
  }
  return null;
}
