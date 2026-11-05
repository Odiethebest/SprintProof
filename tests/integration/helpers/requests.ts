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
