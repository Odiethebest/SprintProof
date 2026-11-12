import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { toSignInPath } from "@/lib/auth/sign-in-redirect";
import { MAX_VOTES_PER_RETRO } from "@/lib/retro/retro-votes";
import { selectSprint } from "@/lib/sprints";
import { PageHeader } from "@/components/layout/page-header";
import { PageLoading } from "@/components/layout/page-loading";
import { readRequestedSprintId } from "@/components/layout/sprint-navigation";
import {
  EMPTY_STATE_LINK_CLASSES,
  EmptyState,
} from "@/components/ui/empty-state";
import { requireTeamRole } from "@/server/auth";
import { listSprints } from "@/server/repositories/sprints";
import { findTeam } from "@/server/repositories/teams";

export const metadata: Metadata = { title: "Retro · SprintProof" };

type Params = Promise<{ teamId: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

// The team navigation's Retro link (#13): opens the retro of the sprint picked
// in the selector, or of the newest sprint that has started.
export default function RetroIndexPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  return (
    <Suspense fallback={<PageLoading />}>
      <RetroIndex params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function RetroIndex({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { teamId } = await params;
  const access = await requireTeamRole(teamId, [
    "LEAD",
    "MEMBER",
    "INSTRUCTOR",
  ]);
  if (!access.isAllowed) {
    if (access.status === 401) {
      redirect(toSignInPath({ callbackPath: `/teams/${teamId}/retro` }));
    }
    notFound();
  }
  const [team, sprints] = await Promise.all([
    findTeam({ teamId }),
    listSprints({ teamId }),
  ]);
  if (team === null) {
    notFound();
  }
  const sprint = selectSprint({
    sprints,
    requestedSprintId: readRequestedSprintId(await searchParams),
    now: new Date(),
    timeZone: team.timezone,
  });
  if (sprint !== null) {
    redirect(`/teams/${teamId}/sprints/${sprint.id}/retro`);
  }
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 md:px-6">
      <PageHeader
        title="Retro"
        meta={`${MAX_VOTES_PER_RETRO} votes each, 1 per item`}
        action={null}
      />
      <EmptyState Icon={CalendarDays}>
        <p className="text-sm text-text-muted">No sprint has started yet.</p>
        {access.role === "LEAD" ? (
          <Link
            href={`/teams/${teamId}/settings`}
            className={EMPTY_STATE_LINK_CLASSES}
          >
            Add a sprint in Settings
          </Link>
        ) : (
          <p className="text-sm text-text-muted">
            A lead can add one in Settings.
          </p>
        )}
      </EmptyState>
    </main>
  );
}
