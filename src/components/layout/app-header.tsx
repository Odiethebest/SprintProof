import Link from "next/link";
import type { TeamRole } from "@/lib/auth/team-access";
import { UserMenu } from "@/components/auth/user-menu";
import { AppMark } from "@/components/ui/app-mark";
import {
  SprintSelector,
  type SprintLinkView,
} from "@/components/layout/sprint-selector";
import { TeamNav, type TeamNavProps } from "@/components/layout/team-nav";
import { LiveIndicator } from "@/components/realtime/live-indicator";

interface AppHeaderProps {
  team: { name: string; repoFullName: string } | null;
  user: { displayName: string; githubLogin: string | null };
  role: TeamRole | null;
  // Team pages only; null elsewhere.
  teamNav: TeamNavProps | null;
  // Pages that show one sprint; null when there's nothing to pick from.
  sprintSelector: { options: SprintLinkView[]; selectedId: string } | null;
}

// The shared top bar (AGENTS.md §2 Screens). The LiveIndicator shows only on
// pages wrapped in a TeamLiveProvider, the ones that update live.
export function AppHeader({
  team,
  user,
  role,
  teamNav,
  sprintSelector,
}: AppHeaderProps) {
  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-2 md:px-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2">
            <Link
              href="/"
              className="flex min-w-0 items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            >
              <AppMark size="sm" />
              {team === null ? (
                <span className="text-sm font-semibold">SprintProof</span>
              ) : (
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-semibold">
                    {team.name}
                  </span>
                  <span className="hidden truncate text-xs text-text-muted sm:block">
                    {team.repoFullName}
                  </span>
                </span>
              )}
            </Link>
            {sprintSelector !== null && (
              <SprintSelector
                options={sprintSelector.options}
                selectedId={sprintSelector.selectedId}
              />
            )}
            <LiveIndicator />
          </div>
          <UserMenu
            name={user.displayName}
            githubLogin={user.githubLogin}
            role={role}
          />
        </div>
        {teamNav !== null && <TeamNav {...teamNav} />}
      </div>
    </header>
  );
}
