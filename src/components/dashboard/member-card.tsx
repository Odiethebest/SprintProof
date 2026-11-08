import type { TeamRole } from "@/lib/auth/team-access";
import type { RequirementProgress } from "@/lib/checks";
import { LiveCount } from "@/components/realtime/live-count";
import { RolePill } from "@/components/teams/role-pill";
import { Avatar } from "@/components/ui/avatar";
import { RequirementChecklist } from "./requirement-checklist";

export interface MemberCardView {
  userId: string;
  name: string;
  githubLogin: string | null;
  role: TeamRole;
  isViewer: boolean;
  commits: number;
  pullRequests: number;
  standups: RequirementProgress;
  reviews: RequirementProgress;
}

function CountTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-1 rounded-md border border-border p-3">
      <dt className="text-xs text-text-muted">{label}</dt>
      <dd className="font-mono text-lg font-semibold tabular-nums">
        <LiveCount value={value} />
      </dd>
    </div>
  );
}

// AGENTS.md §2 MemberCard: counts only. No percentages, ranking or comparisons.
export function MemberCard({
  member,
  isSprintRunning,
}: {
  member: MemberCardView;
  isSprintRunning: boolean;
}) {
  const headingId = `member-${member.userId}-name`;
  return (
    <article
      aria-labelledby={headingId}
      className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 md:p-6"
    >
      <div className="flex items-start gap-3">
        <Avatar name={member.name} size="lg" />
        <div className="flex min-w-0 flex-1 flex-col">
          <h2 id={headingId} className="truncate text-sm font-semibold">
            {member.name}
            {member.isViewer && (
              <span className="font-normal text-text-muted"> (you)</span>
            )}
          </h2>
          {member.githubLogin !== null && (
            <p className="truncate text-xs text-text-muted">
              @{member.githubLogin}
            </p>
          )}
        </div>
        <RolePill role={member.role} />
      </div>
      <dl className="grid grid-cols-2 gap-2">
        <CountTile label="Commits" value={member.commits} />
        <CountTile label="PRs" value={member.pullRequests} />
        <CountTile label="Reviews" value={member.reviews.count} />
        <CountTile label="Standups" value={member.standups.count} />
      </dl>
      <div className="border-t border-border pt-4">
        <RequirementChecklist
          standups={member.standups}
          reviews={member.reviews}
          isSprintRunning={isSprintRunning}
        />
      </div>
    </article>
  );
}
