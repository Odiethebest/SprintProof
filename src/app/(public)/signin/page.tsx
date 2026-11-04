import type { Metadata } from "next";
import { Suspense } from "react";
import { SignInCard } from "@/components/auth/sign-in-card";
import {
  toContinueMessage,
  toSafeCallbackPath,
} from "@/lib/auth/sign-in-redirect";

export const metadata: Metadata = { title: "Sign in · SprintProof" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function SignInPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      {/* Query params are request data, so with cacheComponents they stream in;
          the static shell shows the plain card meanwhile. */}
      <Suspense
        fallback={
          <SignInCard
            callbackPath="/"
            continueMessage={null}
            hasError={false}
          />
        }
      >
        <SignInCardForRequest searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function SignInCardForRequest({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { callbackUrl, error } = await searchParams;
  const callbackPath = toSafeCallbackPath({ callbackUrl });
  return (
    <SignInCard
      callbackPath={callbackPath}
      continueMessage={toContinueMessage({ callbackPath })}
      // Auth.js sends failed sign-ins back here with ?error=<code>.
      hasError={error !== undefined}
    />
  );
}
