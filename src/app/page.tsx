import { Suspense } from "react";
import { redirect } from "next/navigation";
import { UserMenu } from "@/components/auth/user-menu";
import { AppMark } from "@/components/ui/app-mark";
import { getSession } from "@/server/auth-session";

export default function HomePage() {
  return (
    // The session is request data, so with cacheComponents it streams in.
    <Suspense
      fallback={
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-12 md:px-6">
          <p className="text-sm text-text-muted">Loading…</p>
        </main>
      }
    >
      <SignedInHome />
    </Suspense>
  );
}

// TODO(#7): send members to their team dashboard once teams exist.
async function SignedInHome() {
  const session = await getSession();
  if (!session) {
    redirect("/signin");
  }
  const { name, githubLogin } = session.user;
  const displayName = name ?? githubLogin ?? "Your account";

  return (
    <>
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-2 md:px-6">
          <div className="flex items-center gap-2">
            <AppMark size="sm" />
            <span className="text-sm font-semibold">SprintProof</span>
          </div>
          <UserMenu name={displayName} githubLogin={githubLogin} />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-2 px-4 py-12 md:px-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          Welcome, {displayName}
        </h1>
        <p className="text-sm text-text-muted">
          You&apos;re signed in. Teams you create or join will show up here.
        </p>
      </main>
    </>
  );
}
