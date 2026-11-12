import Link from "next/link";
import type { TeamRole } from "@/lib/auth/team-access";
import {
  SPRINT_PAGES,
  getSprintPagePath,
  getTeamNavPages,
  getTeamPagePath,
  type TeamPage,
} from "@/lib/teams/team-pages";

const LABELS: Record<TeamPage, string> = {
  dashboard: "Dashboard",
  standups: "Standups",
  retro: "Retro",
  review: "Review",
  settings: "Settings",
};

const LINK_CLASSES = {
  current:
    "inline-flex h-9 items-center rounded-md bg-primary/10 px-3 text-sm font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
  other:
    "inline-flex h-9 items-center rounded-md px-3 text-sm font-medium text-text-muted transition-colors duration-150 ease-out hover:bg-text/5 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
} as const;

export interface TeamNavProps {
  teamId: string;
  // Review is listed only for the roles that can open it.
  role: TeamRole;
  // null on a team page the navigation doesn't list: no link is current.
  current: TeamPage | null;
  // The sprint picked in the selector, kept when moving between sprint pages.
  requestedSprintId: string | null;
  // The sprint whose retro Retro opens: the picked one, else the one the
  // selector shows. null before any sprint has started.
  retroSprintId: string | null;
}

function getNavHref({
  teamId,
  page,
  requestedSprintId,
  retroSprintId,
}: Omit<TeamNavProps, "role" | "current"> & { page: TeamPage }): string {
  // Each retro has its own path, so Retro links to one directly (#13).
  const sprintId = page === "retro" ? retroSprintId : requestedSprintId;
  return SPRINT_PAGES.includes(page) && sprintId !== null
    ? getSprintPagePath({ teamId, page, sprintId })
    : getTeamPagePath({ teamId, page });
}

// Links between a team's pages (DESIGN.md §6 Top bar).
export function TeamNav({
  teamId,
  role,
  current,
  requestedSprintId,
  retroSprintId,
}: TeamNavProps) {
  return (
    <nav aria-label="Team">
      <ul className="flex flex-wrap gap-1">
        {getTeamNavPages({ role }).map((page) => {
          const isCurrent = page === current;
          return (
            <li key={page}>
              <Link
                href={getNavHref({
                  teamId,
                  page,
                  requestedSprintId,
                  retroSprintId,
                })}
                aria-current={isCurrent ? "page" : undefined}
                className={
                  isCurrent ? LINK_CLASSES.current : LINK_CLASSES.other
                }
              >
                {LABELS[page]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
