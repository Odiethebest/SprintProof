import { describe, expect, it } from "vitest";
import crypto from "node:crypto";
import { verifyWebhookSignature } from "@/lib/github/webhook-signature";

function createSignature(payload: string, secret: string): string {
  return `sha256=${crypto.createHmac("sha256", secret).update(payload).digest("hex")}`;
}

describe("verifyWebhookSignature", () => {
  const secret = "test-secret-12345";
  const payload = JSON.stringify({ zen: "Responsive is better than fast." });

  it("returns true for a matching signature", () => {
    const signatureHeader = createSignature(payload, secret);
    expect(
      verifyWebhookSignature({
        rawBody: payload,
        signatureHeader,
        secret,
      })
    ).toBe(true);
  });

  it("returns false when the signature header is null or undefined", () => {
    expect(
      verifyWebhookSignature({
        rawBody: payload,
        signatureHeader: null,
        secret,
      })
    ).toBe(false);
  });

  it("returns false when the signature does not start with sha256=", () => {
    const rawDigest = crypto.createHmac("sha256", secret).update(payload).digest("hex");
    expect(
      verifyWebhookSignature({
        rawBody: payload,
        signatureHeader: rawDigest,
        secret,
      })
    ).toBe(false);
  });

  it("returns false when the secret is different", () => {
    const signatureHeader = createSignature(payload, "wrong-secret");
    expect(
      verifyWebhookSignature({
        rawBody: payload,
        signatureHeader,
        secret,
      })
    ).toBe(false);
  });

  it("returns false when the payload has been tampered with", () => {
    const signatureHeader = createSignature(payload, secret);
    expect(
      verifyWebhookSignature({
        rawBody: payload + " ",
        signatureHeader,
        secret,
      })
    ).toBe(false);
  });

  it("returns false when the signature hex length does not match", () => {
    expect(
      verifyWebhookSignature({
        rawBody: payload,
        signatureHeader: "sha256=abcdef",
        secret,
      })
    ).toBe(false);
  });

  it("verifies an empty payload correctly", () => {
    const emptyPayload = "";
    const signatureHeader = createSignature(emptyPayload, secret);
    expect(
      verifyWebhookSignature({
        rawBody: emptyPayload,
        signatureHeader,
        secret,
      })
    ).toBe(true);
  });
});
