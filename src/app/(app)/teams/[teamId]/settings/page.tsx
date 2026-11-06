import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { toSignInPath } from "@/lib/auth/sign-in-redirect";
import { INVITE_ROLES } from "@/lib/invites/invite-link";
import { AppHeader } from "@/components/layout/app-header";
import { PageHeader } from "@/components/layout/page-header";
import { PageLoading } from "@/components/layout/page-loading";
import type { InviteLinkView } from "@/components/teams/invite-links";
import { MembersCard } from "@/components/teams/members-card";
import { RepositoryCard } from "@/components/teams/repository-card";
import { requireTeamRole } from "@/server/auth";
import { getCurrentUser } from "@/server/current-user";
import { getLastWebhookDelivery } from "@/server/repositories/activities";
import { listActiveInvites } from "@/server/repositories/invites";
import { listTeamMembers } from "@/server/repositories/memberships";
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
  const [user, team, memberships, origin, lastDelivery] = await Promise.all([
    getCurrentUser(),
    findTeam({ teamId }),
    listTeamMembers({ teamId }),
    getRequestOrigin(),
    getLastWebhookDelivery({ teamId }),
  ]);
  if (user === null || team === null) {
    notFound();
  }
  const inviteLinks =
    access.role === "LEAD"
      ? await loadInviteLinks({ teamId, timezone: team.timezone, origin })
      : null;
  const members = memberships.map(({ role, user: member }) => ({
    userId: member.id,
    displayName: member.name ?? member.githubLogin ?? "GitHub user",
    githubLogin: member.githubLogin,
    role,
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
        {/* TODO(#8): Sprints and requirements card. TODO(#16): API tokens card. */}
        <div className="grid gap-4 lg:grid-cols-2">
          <RepositoryCard
            repoFullName={team.repoFullName}
            webhookUrl={
              access.role === "LEAD" ? `${origin}/api/webhooks/github` : null
            }
            isLead={access.role === "LEAD"}
            lastDeliveryFormatted={lastDelivery ? "Verified" : null}
          />
          <MembersCard
            teamId={team.id}
            currentUserId={user.id}
            members={members}
            inviteLinks={inviteLinks}
          />
        </div>
      </main>
    </>
  );
}

async function loadInviteLinks({
  teamId,
  timezone,
  origin,
}: {
  teamId: string;
  timezone: string;
  origin: string;
}): Promise<InviteLinkView[]> {
  const invites = await listActiveInvites({ teamId, now: new Date() });
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
