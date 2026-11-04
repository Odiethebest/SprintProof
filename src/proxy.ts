import { NextResponse } from "next/server";
import { isProtectedPath, toSignInPath } from "@/lib/auth/sign-in-redirect";
import { authProxy } from "@/server/auth-proxy";

// Optimistic check on the session cookie only, no database. Pages and route
// handlers still call requireTeamRole(); this redirect is not access control.
export const proxy = authProxy((request) => {
  const { pathname, search } = request.nextUrl;
  if (request.auth || !isProtectedPath({ pathname })) {
    return NextResponse.next();
  }
  const signInPath = toSignInPath({ callbackPath: `${pathname}${search}` });
  return NextResponse.redirect(new URL(signInPath, request.nextUrl.origin));
});

export const config = {
  // Pages only: skip API routes, Next.js assets and files with an extension.
  matcher: ["/((?!api|_next/static|_next/image|.*\\..*).*)"],
};
