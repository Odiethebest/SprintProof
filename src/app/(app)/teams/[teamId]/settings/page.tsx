import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { TZDate } from "@date-fns/tz";
import { maskApiToken } from "@/lib/api-tokens/api-token";
import { toSignInPath } from "@/lib/auth/sign-in-redirect";
import { toWebhookSecretLast4 } from "@/lib/github/webhook-secret";
import {
  getManageableInviteRoles,
  type InviteRole,
} from "@/lib/invites/invite-link";
import { getSprintState } from "@/lib/sprints";
import {
  ApiTokensCard,
  type ApiTokenView,
} from "@/components/api-tokens/api-tokens-card";
import { PageHeader } from "@/components/layout/page-header";
import { PageLoading } from "@/components/layout/page-loading";
import {
  SprintsCard,
  type SprintView,
} from "@/components/sprints/sprints-card";
import type { InviteLinkView } from "@/components/teams/invite-links";
import { MembersCard } from "@/components/teams/members-card";
import { RepositoryCard } from "@/components/teams/repository-card";
import type { WebhookSecretView } from "@/components/teams/webhook-secret-field";
import { requireTeamRole } from "@/server/auth";
import { isCourseStaff } from "@/server/course-staff";
import { getCurrentUser } from "@/server/current-user";
import { getLastWebhookDelivery } from "@/server/repositories/activities";
import { listApiTokens } from "@/server/repositories/api-tokens";
import { listActiveInvites } from "@/server/repositories/invites";
import { listTeamMembers } from "@/server/repositories/memberships";
import { listSprints } from "@/server/repositories/sprints";
import {
  findTeam,
  findTeamWebhookSecret,
  isTeamRepoVerified,
} from "@/server/repositories/teams";
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
  const [
    user,
    team,
    memberships,
    sprints,
    origin,
    lastDelivery,
    apiTokens,
    isStaff,
    isRepoVerified,
  ] = await Promise.all([
    getCurrentUser(),
    findTeam({ teamId }),
    listTeamMembers({ teamId }),
    listSprints({ teamId }),
    getRequestOrigin(),
    getLastWebhookDelivery({ teamId }),
    listApiTokens({ userId: access.userId }),
    isCourseStaff({ userId: access.userId }),
    isTeamRepoVerified({ teamId }),
  ]);
  if (user === null || team === null) {
    notFound();
  }
  // Decision 006 (#116): the lead sees the member link, course staff and the
  // team's instructors the instructor link. A member sees no invite controls.
  const inviteRoles = getManageableInviteRoles({
    teamRole: access.role,
    isCourseStaff: isStaff,
  });
  const inviteLinks =
    inviteRoles.length > 0
      ? await loadInviteLinks({
          teamId,
          roles: inviteRoles,
          timezone: team.timezone,
          origin,
        })
      : null;
  const webhookSecret =
    access.role === "LEAD" ? await loadWebhookSecret({ teamId }) : null;
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
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 md:px-6">
        <PageHeader
          title="Settings"
          meta={`${team.name} team settings`}
          action={null}
        />
        <div className="grid gap-4 lg:grid-cols-2">
          <RepositoryCard
            teamId={team.id}
            repoFullName={team.repoFullName}
            webhookUrl={
              access.role === "LEAD" ? `${origin}/api/webhooks/github` : null
            }
            webhookSecret={webhookSecret}
            isLead={access.role === "LEAD"}
            isRepoVerified={isRepoVerified}
            lastDelivery={
              lastDelivery === null
                ? null
                : {
                    event: lastDelivery.event,
                    deliveredAtLabel: formatDeliveryTime({
                      deliveredAt: lastDelivery.deliveredAt,
                      timezone: team.timezone,
                    }),
                  }
            }
          />
          <MembersCard
            teamId={team.id}
            currentUserId={user.id}
            members={members}
            inviteLinks={inviteLinks}
          />
        </div>
        <SprintsCard
          teamId={team.id}
          role={access.role}
          sprints={sprintViews}
        />
        <ApiTokensCard
          tokens={toApiTokenViews({ apiTokens, timezone: team.timezone })}
        />
      </main>
    </>
  );
}

// Lead only: the full secret goes to the page so "Copy" can put it on the
// clipboard for GitHub. Other roles never load it (decision 005, #115).
async function loadWebhookSecret({
  teamId,
}: {
  teamId: string;
}): Promise<WebhookSecretView | null> {
  const stored = await findTeamWebhookSecret({ teamId });
  if (stored === null) {
    return null;
  }
  return {
    secret: stored.webhookSecret,
    last4: toWebhookSecretLast4({ webhookSecret: stored.webhookSecret }),
    canUseServerWebhookSecret: stored.canUseServerWebhookSecret,
  };
}

// "Nov 3, 2:41 PM" in the team's timezone (DESIGN.md §9).
function formatDeliveryTime({
  deliveredAt,
  timezone,
}: {
  deliveredAt: Date;
  timezone: string;
}): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  }).format(deliveredAt);
}

// "Nov 8" in the team's timezone (DESIGN.md §9). Tokens belong to the user,
// but Settings shows every date in the team's timezone.
function toApiTokenViews({
  apiTokens,
  timezone,
}: {
  apiTokens: Awaited<ReturnType<typeof listApiTokens>>;
  timezone: string;
}): ApiTokenView[] {
  const dateFormat = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: timezone,
  });
  return apiTokens.map((apiToken) => ({
    id: apiToken.id,
    name: apiToken.name,
    maskedToken: maskApiToken({ last4: apiToken.last4 }),
    createdLabel: dateFormat.format(apiToken.createdAt),
    lastUsedLabel:
      apiToken.lastUsedAt === null
        ? null
        : dateFormat.format(apiToken.lastUsedAt),
  }));
}

async function loadInviteLinks({
  teamId,
  roles,
  timezone,
  origin,
}: {
  teamId: string;
  roles: InviteRole[];
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
  return roles.map((role) => {
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
