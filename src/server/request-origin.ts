import { headers } from "next/headers";

// The origin the visitor used, so links shown on a page work on previews too.
export async function getRequestOrigin(): Promise<string> {
  const requestHeaders = await headers();
  const host = (
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    "localhost:3000"
  )
    .split(",")[0]
    .trim();
  const protocol =
    requestHeaders.get("x-forwarded-proto")?.split(",")[0].trim() ??
    (host.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
}
