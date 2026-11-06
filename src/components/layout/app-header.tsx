import Link from "next/link";
import type { TeamRole } from "@/lib/auth/team-access";
import { UserMenu } from "@/components/auth/user-menu";
import { AppMark } from "@/components/ui/app-mark";

interface AppHeaderProps {
  team: { name: string; repoFullName: string } | null;
  user: { displayName: string; githubLogin: string | null };
  role: TeamRole | null;
}

// The shared top bar (AGENTS.md §2 Screens).
// TODO(#12): add the sprint selector and the LiveIndicator on team pages.
export function AppHeader({ team, user, role }: AppHeaderProps) {
  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-2 md:px-6">
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
        <UserMenu
          name={user.displayName}
          githubLogin={user.githubLogin}
          role={role}
        />
      </div>
    </header>
  );
}
