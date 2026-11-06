import crypto from "node:crypto";

const API_BASE = "http://localhost:3000/api/v1";

// Route handlers get plain web Requests, the same as Next.js passes them.
export function apiRequest(
  method: "POST" | "DELETE",
  path: string,
  body?: unknown
): Request {
  return new Request(`${API_BASE}${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export function routeContext<Params>(params: Params): {
  params: Promise<Params>;
} {
  return { params: Promise.resolve(params) };
}

export function signWebhookPayload(payload: string, secret: string): string {
  return `sha256=${crypto.createHmac("sha256", secret).update(payload).digest("hex")}`;
}

export function webhookRequest({
  event,
  deliveryId,
  signature,
  body,
}: {
  event: string;
  deliveryId?: string;
  signature?: string;
  body: string | unknown;
}): Request {
  const payloadString = typeof body === "string" ? body : JSON.stringify(body);
  const headers = new Headers({
    "content-type": "application/json",
    "x-github-event": event,
    "x-github-delivery": deliveryId ?? "72d3162e-cc78-11e3-81ab-4c9367dc0ff0",
  });
  if (signature !== undefined) {
    headers.set("x-hub-signature-256", signature);
  }
  return new Request("http://localhost:3000/api/webhooks/github", {
    method: "POST",
    headers,
    body: payloadString,
  });
}
