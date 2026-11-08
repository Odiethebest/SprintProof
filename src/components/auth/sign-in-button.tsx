"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { GithubMark } from "@/components/auth/github-mark";

// Client-side signIn posts to the Auth.js route handler; AGENTS.md rules out Server Actions.
export function SignInButton({ callbackPath }: { callbackPath: string }) {
  const [isRedirecting, setIsRedirecting] = useState(false);

  function handleClick() {
    setIsRedirecting(true);
    signIn("github", { redirectTo: callbackPath }).catch(() =>
      setIsRedirecting(false)
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isRedirecting}
      className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-fg transition-colors duration-150 ease-out hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:opacity-60"
    >
      <GithubMark className="size-4" />
      Sign in with GitHub
    </button>
  );
}
