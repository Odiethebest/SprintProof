import type { DefaultSession } from "next-auth";

// next-auth re-exports these from @auth/core, so augment them where they're declared.
declare module "@auth/core/types" {
  interface Session {
    user: { id: string; githubLogin: string | null } & DefaultSession["user"];
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    githubLogin?: string | null;
  }
}
