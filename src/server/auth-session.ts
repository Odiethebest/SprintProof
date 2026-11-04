// The one wrapper around Auth.js. Tests mock this module instead of the library.
import NextAuth from "next-auth";
import { connection } from "next/server";
import { isTestAuthEnabled } from "@/lib/auth/test-auth";
import { createAuthConfig } from "@/server/auth-config";

// Lazy config: env is read per request, so E2E_TEST_AUTH can't be baked into a build.
// `auth` stays private: server code reads the session through getSession().
const { handlers, auth } = NextAuth(() =>
  createAuthConfig({
    isTestAuthEnabled: isTestAuthEnabled({
      e2eTestAuth: process.env.E2E_TEST_AUTH,
      vercelEnv: process.env.VERCEL_ENV,
    }),
  })
);

export { handlers };

// Reading the session re-encrypts the cookie (rolling expiry), which calls
// crypto.getRandomValues(). With cacheComponents that has to wait for a real
// request instead of running while Next.js prerenders.
export async function getSession() {
  await connection();
  return auth();
}

export async function getSessionUserId(): Promise<string | null> {
  const session = await getSession();
  return session?.user.id ?? null;
}
