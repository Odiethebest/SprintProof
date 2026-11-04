import { z } from "zod";

const PROTECTED_PREFIXES = ["/teams", "/review"] as const;
const SIGN_IN_PATH = "/signin";
const HOME_PATH = "/";
// Resolves relative callbacks so a different origin shows up as a mismatch.
const PLACEHOLDER_ORIGIN = "http://sprintproof.invalid";

const PAGE_NAMES: ReadonlyArray<{ pattern: RegExp; page: string }> = [
  { pattern: /^\/teams\/[^/]+\/dashboard$/, page: "the dashboard" },
  { pattern: /^\/teams\/[^/]+\/standups$/, page: "standups" },
  { pattern: /^\/teams\/[^/]+\/sprints\/[^/]+\/retro$/, page: "the retro" },
  { pattern: /^\/teams\/[^/]+\/settings$/, page: "settings" },
  { pattern: /^\/review\/[^/]+$/, page: "the review page" },
];

const callbackUrlSchema = z
  .string()
  .startsWith("/")
  .refine((value) => URL.canParse(value, PLACEHOLDER_ORIGIN));

export function isProtectedPath({ pathname }: { pathname: string }): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function toSignInPath({
  callbackPath,
}: {
  callbackPath: string;
}): string {
  return `${SIGN_IN_PATH}?${new URLSearchParams({ callbackUrl: callbackPath })}`;
}

// Prevents open redirects: only same-site paths survive, anything else goes home.
export function toSafeCallbackPath({
  callbackUrl,
}: {
  callbackUrl: string | string[] | undefined;
}): string {
  const parsed = callbackUrlSchema.safeParse(callbackUrl);
  if (!parsed.success) {
    return HOME_PATH;
  }
  // "//host" and "/\host" start with "/" but resolve to another origin.
  const url = new URL(parsed.data, PLACEHOLDER_ORIGIN);
  if (url.origin !== PLACEHOLDER_ORIGIN || url.pathname === SIGN_IN_PATH) {
    return HOME_PATH;
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

export function toContinueMessage({
  callbackPath,
}: {
  callbackPath: string;
}): string | null {
  const pathname = new URL(callbackPath, PLACEHOLDER_ORIGIN).pathname.replace(
    /\/+$/,
    ""
  );
  const match = PAGE_NAMES.find(({ pattern }) => pattern.test(pathname));
  return match ? `Sign in to continue to ${match.page}.` : null;
}
