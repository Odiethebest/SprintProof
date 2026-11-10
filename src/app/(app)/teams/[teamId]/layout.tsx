import { Suspense, type ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import { requireTeamRole } from "@/server/auth";
import { getCurrentUser } from "@/server/current-user";
import { findTeam } from "@/server/repositories/teams";
import { listSprints } from "@/server/repositories/sprints";
import { selectSprint } from "@/lib/sprints";
import { toSignInPath } from "@/lib/auth/sign-in-redirect";
import { buildSprintSelector } from "@/components/layout/sprint-navigation";
import { TeamShell } from "@/components/layout/team-shell";
import { PageLoading } from "@/components/layout/page-loading";

type Props = { params: Promise<{ teamId: string }>; children: ReactNode };

export default function TeamLayout(props: Props) {
  return (
    <Suspense fallback={<PageLoading />}>
      <TeamLayoutContent {...props} />
    </Suspense>
  );
}

async function TeamLayoutContent({ params, children }: Props) {
  const { teamId } = await params;
  const access = await requireTeamRole(teamId, [
    "LEAD",
    "MEMBER",
    "INSTRUCTOR",
  ]);
  if (!access.isAllowed) {
    if (access.status === 401)
      redirect(toSignInPath({ callbackPath: `/teams/${teamId}/dashboard` }));
    notFound();
  }
  const [user, team, sprints] = await Promise.all([
    getCurrentUser(),
    findTeam({ teamId }),
    listSprints({ teamId }),
  ]);
  if (user === null || team === null) notFound();
  const now = new Date();
  const sprint = selectSprint({
    sprints,
    requestedSprintId: null,
    now,
    timeZone: team.timezone,
  });
  return (
    <TeamShell
      teamId={teamId}
      team={team}
      user={user}
      role={access.role}
      sprintSelector={buildSprintSelector({
        sprints,
        selectedId: sprint?.id ?? null,
        now,
        timeZone: team.timezone,
      })}
    >
      {children}
    </TeamShell>
  );
}
