import { z } from "zod";
import { GITHUB_LOGIN_PATTERN } from "@/lib/github/login";
import type { GithubUser } from "@/lib/github/profile";

export const TEST_AUTH_PROVIDER_ID = "e2e-credentials";

const testSignInSchema = z.object({
  login: z.string().regex(GITHUB_LOGIN_PATTERN),
  name: z.string().min(1).max(100),
});

export function isTestAuthEnabled({
  e2eTestAuth,
  vercelEnv,
}: {
  e2eTestAuth: string | undefined;
  vercelEnv: string | undefined;
}): boolean {
  // Never on Vercel, previews included: those URLs are public, and a test
  // sign-in there would let anyone in as anyone (AGENTS.md §1 Testing strategy).
  if (vercelEnv) {
    return false;
  }
  return e2eTestAuth === "true";
}

export function toTestGithubUser({
  credentials,
}: {
  credentials: unknown;
}): GithubUser | null {
  const parsed = testSignInSchema.safeParse(credentials);
  if (!parsed.success) {
    return null;
  }
  // "e2e-" can't collide with a real GitHub id, which is always numeric.
  return {
    githubId: `e2e-${parsed.data.login}`,
    githubLogin: parsed.data.login,
    name: parsed.data.name,
    avatarUrl: null,
  };
}
