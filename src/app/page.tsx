import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Users } from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { PageHeader } from "@/components/layout/page-header";
import { PageLoading } from "@/components/layout/page-loading";
import { RolePill } from "@/components/teams/role-pill";
import { BUTTON_CLASSES } from "@/components/ui/button-styles";
import { getCurrentUser } from "@/server/current-user";
import { listTeamsForUser } from "@/server/repositories/teams";

export default function HomePage() {
  return (
    // The session is request data, so with cacheComponents it streams in.
    <Suspense fallback={<PageLoading />}>
      <SignedInHome />
    </Suspense>
  );
}

async function SignedInHome() {
  const user = await getCurrentUser();
  if (user === null) {
    redirect("/signin");
  }
  const teams = await listTeamsForUser({ userId: user.id });

  return (
    <>
      <AppHeader team={null} user={user} role={null} />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 md:px-6">
        <PageHeader
          title="Your teams"
          meta="Teams you create or join show up here."
          action={
            <Link href="/teams/new" className={BUTTON_CLASSES.primary}>
              <Plus size={16} aria-hidden="true" />
              Create a team
            </Link>
          }
        />
        {teams.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-md border border-border p-6 text-center">
            <Users size={24} aria-hidden="true" className="text-text-muted" />
            <p className="text-sm text-text-muted">
              You&apos;re not on a team yet. Create one, or open the invite link
              your team lead sent you.
            </p>
          </div>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {teams.map((team) => (
              <li key={team.id}>
                {/* TODO(#12): link to the team dashboard once it exists. */}
                <Link
                  href={`/teams/${team.id}/settings`}
                  className="flex items-center justify-between gap-4 rounded-lg border border-border bg-surface p-4 transition-colors duration-150 ease-out hover:bg-text/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-canvas md:p-6"
                >
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="truncate text-lg font-semibold">
                      {team.name}
                    </span>
                    <span className="truncate font-mono text-xs text-text-muted">
                      {team.repoFullName}
                    </span>
                  </span>
                  <RolePill role={team.role} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
