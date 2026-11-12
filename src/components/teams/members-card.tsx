import type { TeamRole } from "@/lib/auth/team-access";
import {
  InviteLinks,
  type InviteLinkView,
} from "@/components/teams/invite-links";
import { RolePill } from "@/components/teams/role-pill";
import { Avatar } from "@/components/ui/avatar";

export interface MemberView {
  userId: string;
  displayName: string;
  githubLogin: string | null;
  role: TeamRole;
}

// Settings "Members and invites". Invite links are only passed in for people
// who can manage at least one of them (the lead, course staff, the team's
// instructors); for anyone else they aren't rendered at all (AGENTS.md §2
// Screens).
export function MembersCard({
  teamId,
  currentUserId,
  members,
  inviteLinks,
}: {
  teamId: string;
  currentUserId: string;
  members: MemberView[];
  inviteLinks: InviteLinkView[] | null;
}) {
  return (
    <section
      aria-labelledby="members-title"
      className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 md:p-6"
    >
      <div className="flex flex-col gap-1">
        <h2 id="members-title" className="text-lg font-semibold">
          Members and invites
        </h2>
        <p className="text-xs text-text-muted">
          Invite links expire after 7 days. Opening one twice never adds someone
          twice.
        </p>
      </div>
      <ul className="divide-y divide-border">
        {members.map((member) => (
          <li
            key={member.userId}
            className="flex items-center justify-between gap-3 py-3"
          >
            <div className="flex min-w-0 items-center gap-3">
              <Avatar name={member.displayName} size="md" />
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium">
                  {member.displayName}
                  {member.userId === currentUserId && (
                    <span className="text-text-muted"> (you)</span>
                  )}
                </span>
                {member.githubLogin && (
                  <span className="truncate font-mono text-xs text-text-muted">
                    @{member.githubLogin}
                  </span>
                )}
              </div>
            </div>
            <RolePill role={member.role} />
          </li>
        ))}
      </ul>
      {inviteLinks && (
        <div className="border-t border-border pt-4">
          <InviteLinks teamId={teamId} links={inviteLinks} />
        </div>
      )}
    </section>
  );
}
