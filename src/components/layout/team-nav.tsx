import Link from "next/link";

export type TeamPage = "dashboard" | "standups" | "settings";

const LINKS: Array<{ page: TeamPage; label: string; keepsSprint: boolean }> = [
  { page: "dashboard", label: "Dashboard", keepsSprint: true },
  { page: "standups", label: "Standups", keepsSprint: true },
  { page: "settings", label: "Settings", keepsSprint: false },
];

const LINK_CLASSES = {
  current:
    "inline-flex h-9 items-center rounded-md bg-primary/10 px-3 text-sm font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
  other:
    "inline-flex h-9 items-center rounded-md px-3 text-sm font-medium text-text-muted transition-colors duration-150 ease-out hover:bg-text/5 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
} as const;

export interface TeamNavProps {
  teamId: string;
  current: TeamPage;
  // The sprint picked in the selector, kept when moving between sprint pages.
  requestedSprintId: string | null;
}

// Links between a team's pages (DESIGN.md §6 Top bar).
export function TeamNav({ teamId, current, requestedSprintId }: TeamNavProps) {
  return (
    <nav aria-label="Team">
      <ul className="flex flex-wrap gap-1">
        {LINKS.map(({ page, label, keepsSprint }) => {
          const query =
            keepsSprint && requestedSprintId !== null
              ? `?sprint=${encodeURIComponent(requestedSprintId)}`
              : "";
          const isCurrent = page === current;
          return (
            <li key={page}>
              <Link
                href={`/teams/${teamId}/${page}${query}`}
                aria-current={isCurrent ? "page" : undefined}
                className={
                  isCurrent ? LINK_CLASSES.current : LINK_CLASSES.other
                }
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
