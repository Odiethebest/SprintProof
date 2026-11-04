import NextAuth from "next-auth";

// The proxy only decodes the session cookie: no providers and no database, so it
// stays light on every page request. It's a separate instance because next-auth's
// auth(handler) returns a Promise when the config is lazy (as in auth-session.ts),
// and Next.js needs `proxy` to be a function.
export const { auth: authProxy } = NextAuth({
  providers: [],
  session: { strategy: "jwt" },
});
