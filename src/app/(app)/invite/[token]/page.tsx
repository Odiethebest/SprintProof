import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CircleAlert, CircleCheck, Users } from "lucide-react";
import type { TeamRole } from "@/lib/auth/team-access";
import { toSignInPath } from "@/lib/auth/sign-in-redirect";
import { checkInvite, joinTeamSchema } from "@/lib/invites/invite-link";
import { AppHeader } from "@/components/layout/app-header";
import { PageLoading } from "@/components/layout/page-loading";
import { JoinTeamButton } from "@/components/teams/join-team-button";
import { RolePill } from "@/components/teams/role-pill";
import { BUTTON_CLASSES } from "@/components/ui/button-styles";
import { getCurrentUser } from "@/server/current-user";
import { findInviteByToken } from "@/server/repositories/invites";
import { findMembershipRole } from "@/server/repositories/memberships";

export const metadata: Metadata = { title: "Join a team · SprintProof" };

type Params = Promise<{ token: string }>;

const JOIN_AS: Record<TeamRole, string> = {
  LEAD: "You'll join as the team lead.",
  MEMBER: "You'll join as a member.",
  INSTRUCTOR: "You'll join as an instructor, with read-only access.",
};

export default function InvitePage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<PageLoading />}>
      <Invite params={params} />
    </Suspense>
  );
}

async function Invite({ params }: { params: Params }) {
  const { token } = await params;
  const user = await getCurrentUser();
  if (user === null) {
    redirect(toSignInPath({ callbackPath: `/invite/${token}` }));
  }
  const parsed = joinTeamSchema.safeParse({ inviteToken: token });
  const invite = parsed.success
    ? await findInviteByToken({ token: parsed.data.inviteToken })
    : null;
  const check = checkInvite({ invite, now: new Date() });
  const membership =
    invite && check.isValid
      ? await findMembershipRole({ userId: user.id, teamId: invite.teamId })
      : null;

  return (
    <>
      <AppHeader
        team={null}
        user={user}
        role={null}
        teamNav={null}
        sprintSelector={null}
      />
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        {!check.isValid || invite === null ? (
          <InviteCard
            icon={<CircleAlert size={24} aria-hidden="true" />}
            title="This invite link can't be used"
          >
            <p className="text-sm">{check.isValid ? null : check.message}</p>
            <BackToTeams />
          </InviteCard>
        ) : membership ? (
          <InviteCard
            icon={<CircleCheck size={24} aria-hidden="true" />}
            title={`You're already on ${invite.team.name}`}
          >
            <p className="flex flex-wrap items-center justify-center gap-2 text-sm">
              Your role stays the same: <RolePill role={membership.role} />
            </p>
            <BackToTeams />
          </InviteCard>
        ) : (
          <InviteCard
            icon={<Users size={24} aria-hidden="true" />}
            title={`Join ${invite.team.name}`}
          >
            <p className="font-mono text-xs text-text-muted">
              {invite.team.repoFullName}
            </p>
            <p className="text-sm">{JOIN_AS[invite.role]}</p>
            <JoinTeamButton inviteToken={token} teamId={invite.teamId} />
          </InviteCard>
        )}
      </main>
    </>
  );
}

function InviteCard({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-lg border border-border bg-surface p-4 text-center md:p-6">
      <span className="text-text-muted">{icon}</span>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {children}
    </div>
  );
}

function BackToTeams() {
  return (
    <Link href="/" className={BUTTON_CLASSES.secondary}>
      Go to your teams
    </Link>
  );
}
