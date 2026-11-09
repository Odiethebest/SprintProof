import crypto from "node:crypto";

const API_BASE = "http://localhost:3000/api/v1";

// Route handlers get plain web Requests, the same as Next.js passes them.
export function apiRequest(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  body?: unknown
): Request {
  return new Request(`${API_BASE}${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

// A GET as an API client sends it. `authorization` is the raw header value, so
// tests can send malformed ones too; leave it out to send no header at all.
export function apiGetRequest(
  path: string,
  { authorization }: { authorization?: string } = {}
): Request {
  const headers = new Headers();
  if (authorization !== undefined) {
    headers.set("authorization", authorization);
  }
  return new Request(`${API_BASE}${path}`, { method: "GET", headers });
}

export function bearer(token: string): string {
  return `Bearer ${token}`;
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
  // null leaves the header out, to test requests GitHub would never send.
  event: string | null;
  deliveryId?: string | null;
  signature?: string;
  body: string | unknown;
}): Request {
  const payloadString = typeof body === "string" ? body : JSON.stringify(body);
  const headers = new Headers({ "content-type": "application/json" });
  if (event !== null) {
    headers.set("x-github-event", event);
  }
  if (deliveryId !== null) {
    headers.set(
      "x-github-delivery",
      deliveryId ?? "72d3162e-cc78-11e3-81ab-4c9367dc0ff0"
    );
  }
  if (signature !== undefined) {
    headers.set("x-hub-signature-256", signature);
  }
  return new Request("http://localhost:3000/api/webhooks/github", {
    method: "POST",
    headers,
    body: payloadString,
  });
}
