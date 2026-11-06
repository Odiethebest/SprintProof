import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { TZDate } from "@date-fns/tz";
import { toSignInPath } from "@/lib/auth/sign-in-redirect";
import { INVITE_ROLES } from "@/lib/invites/invite-link";
import { getSprintState } from "@/lib/sprints";
import { AppHeader } from "@/components/layout/app-header";
import { PageHeader } from "@/components/layout/page-header";
import { PageLoading } from "@/components/layout/page-loading";
import { SprintsCard, type SprintView } from "@/components/sprints/sprints-card";
import type { InviteLinkView } from "@/components/teams/invite-links";
import { MembersCard } from "@/components/teams/members-card";
import { requireTeamRole } from "@/server/auth";
import { getCurrentUser } from "@/server/current-user";
import { listActiveInvites } from "@/server/repositories/invites";
import { listTeamMembers } from "@/server/repositories/memberships";
import { listSprints } from "@/server/repositories/sprints";
import { findTeam } from "@/server/repositories/teams";
import { getRequestOrigin } from "@/server/request-origin";

export const metadata: Metadata = { title: "Settings · SprintProof" };

type Params = Promise<{ teamId: string }>;

export default function SettingsPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<PageLoading />}>
      <TeamSettings params={params} />
    </Suspense>
  );
}

function formatSprintDates(
  startDateStr: string,
  endDateStr: string,
  timeZone: string
): string {
  const [sy, sm, sd] = startDateStr.split("-").map(Number);
  const [ey, em, ed] = endDateStr.split("-").map(Number);
  const start = new TZDate(sy, sm - 1, sd, timeZone);
  const end = new TZDate(ey, em - 1, ed, timeZone);
  const startFormat = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone,
  });
  const endFormat = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone,
  });
  return `${startFormat.format(start)} – ${endFormat.format(end)}`;
}

async function TeamSettings({ params }: { params: Params }) {
  const { teamId } = await params;
  const access = await requireTeamRole(teamId, [
    "LEAD",
    "MEMBER",
    "INSTRUCTOR",
  ]);
  if (!access.isAllowed) {
    if (access.status === 401) {
      redirect(toSignInPath({ callbackPath: `/teams/${teamId}/settings` }));
    }
    // Same page as a team that doesn't exist, so outsiders learn nothing.
    notFound();
  }
  const [user, team, memberships, sprints] = await Promise.all([
    getCurrentUser(),
    findTeam({ teamId }),
    listTeamMembers({ teamId }),
    listSprints({ teamId }),
  ]);
  if (user === null || team === null) {
    notFound();
  }
  const inviteLinks =
    access.role === "LEAD"
      ? await loadInviteLinks({ teamId, timezone: team.timezone })
      : null;
  const members = memberships.map(({ role, user: member }) => ({
    userId: member.id,
    displayName: member.name ?? member.githubLogin ?? "GitHub user",
    githubLogin: member.githubLogin,
    role,
  }));

  const now = new Date();
  const sprintViews: SprintView[] = sprints.map((sprint) => ({
    id: sprint.id,
    name: sprint.name,
    startDate: sprint.startDate,
    endDate: sprint.endDate,
    standupsPerPerson: sprint.standupsPerPerson,
    reviewsPerPerson: sprint.reviewsPerPerson,
    state: getSprintState({
      sprint,
      now,
      timeZone: team.timezone,
    }),
    datesLabel: formatSprintDates(
      sprint.startDate,
      sprint.endDate,
      team.timezone
    ),
  }));

  return (
    <>
      <AppHeader team={team} user={user} role={access.role} />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 md:px-6">
        <PageHeader
          title="Settings"
          meta={`${team.name} team settings`}
          action={null}
        />
        {/* TODO(#11): Repository card. */}
        <div className="grid gap-4 lg:grid-cols-2">
          <MembersCard
            teamId={team.id}
            currentUserId={user.id}
            members={members}
            inviteLinks={inviteLinks}
          />
        </div>
        <SprintsCard teamId={team.id} role={access.role} sprints={sprintViews} />
        {/* TODO(#16): API tokens card. */}
      </main>
    </>
  );
}

async function loadInviteLinks({
  teamId,
  timezone,
}: {
  teamId: string;
  timezone: string;
}): Promise<InviteLinkView[]> {
  const [invites, origin] = await Promise.all([
    listActiveInvites({ teamId, now: new Date() }),
    getRequestOrigin(),
  ]);
  // "Nov 12" in the team's timezone (DESIGN.md §9).
  const expiryFormat = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: timezone,
  });
  return INVITE_ROLES.map((role) => {
    const invite = invites.find((candidate) => candidate.role === role);
    return {
      role,
      invite: invite
        ? {
            id: invite.id,
            url: `${origin}/invite/${invite.token}`,
            expiresLabel: expiryFormat.format(invite.expiresAt),
          }
        : null,
    };
  });
}
