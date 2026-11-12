import { getTimezoneOptions } from "@/lib/teams/timezone-options";
import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { toSignInPath } from "@/lib/auth/sign-in-redirect";
import { AppHeader } from "@/components/layout/app-header";
import { PageHeader } from "@/components/layout/page-header";
import { PageLoading } from "@/components/layout/page-loading";
import { CreateTeamForm } from "@/components/teams/create-team-form";
import { getCurrentUser } from "@/server/current-user";

export const metadata: Metadata = { title: "Create a team · SprintProof" };

export default function NewTeamPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <NewTeam />
    </Suspense>
  );
}

async function NewTeam() {
  const user = await getCurrentUser();
  if (user === null) {
    redirect(toSignInPath({ callbackPath: "/teams/new" }));
  }
  // Read on the server and passed down, so the server and client lists match.
  const timezones = getTimezoneOptions({
    timezones: Intl.supportedValuesOf("timeZone"),
  });

  return (
    <>
      <AppHeader
        team={null}
        user={user}
        role={null}
        teamNav={null}
        sprintSelector={null}
      />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 md:px-6">
        <PageHeader
          title="Create a team"
          meta="You'll be the team lead. Invite your partner from Settings next."
          action={null}
        />
        <section className="w-full max-w-xl rounded-lg border border-border bg-surface p-4 md:p-6">
          <CreateTeamForm timezones={timezones} />
        </section>
      </main>
    </>
  );
}
