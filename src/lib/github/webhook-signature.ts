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
