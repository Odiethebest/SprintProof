// The pages in the team navigation, in nav order (DESIGN.md §6 Top bar).
export const TEAM_PAGES = ["dashboard", "standups", "settings"] as const;

export type TeamPage = (typeof TEAM_PAGES)[number];

// Pages that show one sprint, picked in the top bar's selector (`?sprint=`).
// Moving between them keeps the selected sprint.
export const SPRINT_PAGES: readonly TeamPage[] = ["dashboard", "standups"];

// Pages that update live (DESIGN.md §7 LiveIndicator).
export const LIVE_PAGES: readonly TeamPage[] = ["dashboard", "standups"];

export function getTeamPagePath({
  teamId,
  page,
}: {
  teamId: string;
  page: TeamPage;
}): string {
  return `/teams/${teamId}/${page}`;
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
