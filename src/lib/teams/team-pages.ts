import type { TeamRole } from "@/lib/auth/team-access";

// The pages in the team navigation, in nav order (DESIGN.md §6 Top bar).
export const TEAM_PAGES = [
  "dashboard",
  "standups",
  "review",
  "settings",
] as const;

export type TeamPage = (typeof TEAM_PAGES)[number];

// Who can open the review page (AGENTS.md §2 Review). The page enforces it
// with requireTeamRole(); the navigation only follows it.
export const REVIEW_ROLES: readonly TeamRole[] = ["LEAD", "INSTRUCTOR"];

// Pages that show one sprint, picked in the top bar's selector (`?sprint=`).
// Moving between them keeps the selected sprint.
export const SPRINT_PAGES: readonly TeamPage[] = [
  "dashboard",
  "standups",
  "review",
];

// Pages that update live (DESIGN.md §7 LiveIndicator).
export const LIVE_PAGES: readonly TeamPage[] = ["dashboard", "standups"];

export function getTeamPagePath({
  teamId,
  page,
}: {
  teamId: string;
  page: TeamPage;
}): string {
  // The review page sits outside the team's pages (AGENTS.md §2 Screens).
  return page === "review" ? `/review/${teamId}` : `/teams/${teamId}/${page}`;
}

// The navigation pages a role sees: Review only for leads and instructors.
export function getTeamNavPages({ role }: { role: TeamRole }): TeamPage[] {
  return TEAM_PAGES.filter(
    (page) => page !== "review" || REVIEW_ROLES.includes(role)
  );
}

// The navigation page at this exact path. Any other path, such as a sprint's
// retro, is no navigation page, so nothing is marked current (#93).
export function findTeamPage({
  teamId,
  pathname,
}: {
  teamId: string;
  pathname: string;
}): TeamPage | null {
  return (
    TEAM_PAGES.find((page) => getTeamPagePath({ teamId, page }) === pathname) ??
    null
  );
}
