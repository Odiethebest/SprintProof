import type { NextAuthConfig } from "next-auth";
import type { JWT } from "next-auth/jwt";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import { TEST_AUTH_PROVIDER_ID, toTestGithubUser } from "@/lib/auth/test-auth";
import { toGithubUser } from "@/lib/github/profile";
import { findUserById, upsertGithubUser } from "@/server/repositories/users";

interface SignedInUser {
  id: string;
  githubLogin: string | null;
  name: string | null;
  avatarUrl: string | null;
}

// Decision 001: the token carries our user id and public profile only, never
// GitHub's access token or an email address.
function toSessionToken(user: SignedInUser): JWT {
  return {
    sub: user.id,
    githubLogin: user.githubLogin,
    name: user.name,
    picture: user.avatarUrl,
  };
}

function testCredentialsProvider() {
  return Credentials({
    id: TEST_AUTH_PROVIDER_ID,
    name: "E2E test user",
    credentials: { login: {}, name: {} },
    async authorize(credentials) {
      const testUser = toTestGithubUser({ credentials });
      if (testUser === null) {
        return null;
      }
      const user = await upsertGithubUser(testUser);
      return { id: user.id };
    },
  });
}

async function findSignedInUser(
  provider: string,
  profile: unknown,
  userId: string | undefined
): Promise<SignedInUser> {
  if (provider === TEST_AUTH_PROVIDER_ID) {
    // authorize() has already created the test user.
    const user = userId === undefined ? null : await findUserById(userId);
    if (user === null) {
      throw new Error("Test sign-in returned an unknown user");
    }
    return user;
  }
  return upsertGithubUser(toGithubUser({ profile }));
}

export function createAuthConfig({
  isTestAuthEnabled,
}: {
  isTestAuthEnabled: boolean;
}): NextAuthConfig {
  return {
    providers: [
      // Decision 001: request no OAuth scopes; the public profile has every field we use.
      GitHub({ authorization: { params: { scope: "" } } }),
      ...(isTestAuthEnabled ? [testCredentialsProvider()] : []),
    ],
    session: { strategy: "jwt" },
    pages: { signIn: "/signin" },
    callbacks: {
      async jwt({ token, account, profile, user }) {
        // Auth.js passes `account` only on the sign-in request.
        if (!account) {
          return token;
        }
        const signedIn = await findSignedInUser(
          account.provider,
          profile,
          user?.id
        );
        return toSessionToken(signedIn);
      },
      session({ session, token }) {
        if (!token.sub) {
          throw new Error("Session token has no user id");
        }
        return {
          expires: session.expires,
          user: {
            id: token.sub,
            githubLogin: token.githubLogin ?? null,
            name: token.name ?? null,
            image: token.picture ?? null,
          },
        };
      },
    },
  };
}
