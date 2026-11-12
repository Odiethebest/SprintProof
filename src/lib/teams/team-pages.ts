import type { TeamRole } from "@/lib/auth/team-access";

// The pages in the team navigation, in nav order (DESIGN.md §6 Top bar).
export const TEAM_PAGES = [
  "dashboard",
  "standups",
  "retro",
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
  "retro",
  "review",
];

// Pages that update live (DESIGN.md §7 LiveIndicator).
export const LIVE_PAGES: readonly TeamPage[] = [
  "dashboard",
  "standups",
  "retro",
];

const RETRO_SUFFIX = "/retro";

// The navigation path of each page. Retro's path opens the newest started
// sprint's retro, /teams/{teamId}/sprints/{sprintId}/retro (#13).
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

// A sprint page showing one sprint: the sprint's own retro, or any other
// page with the sprint in `?sprint=`.
export function getSprintPagePath({
  teamId,
  page,
  sprintId,
}: {
  teamId: string;
  page: TeamPage;
  sprintId: string;
}): string {
  if (page === "retro") {
    return `/teams/${teamId}/sprints/${encodeURIComponent(sprintId)}/retro`;
  }
  return `${getTeamPagePath({ teamId, page })}?sprint=${encodeURIComponent(sprintId)}`;
}

// The navigation pages a role sees: Review only for leads and instructors.
export function getTeamNavPages({ role }: { role: TeamRole }): TeamPage[] {
  return TEAM_PAGES.filter(
    (page) => page !== "review" || REVIEW_ROLES.includes(role)
  );
}

// The sprint whose retro is at this exact path, or null for any other path.
export function findRetroSprintId({
  teamId,
  pathname,
}: {
  teamId: string;
  pathname: string;
}): string | null {
  const prefix = `/teams/${teamId}/sprints/`;
  if (!pathname.startsWith(prefix) || !pathname.endsWith(RETRO_SUFFIX)) {
    return null;
  }
  const sprintId = pathname.slice(prefix.length, -RETRO_SUFFIX.length);
  return sprintId === "" || sprintId.includes("/") ? null : sprintId;
}

// The navigation page at this exact path, a sprint's retro being Retro. Any
// other path is no navigation page, so nothing is marked current (#93).
export function findTeamPage({
  teamId,
  pathname,
}: {
  teamId: string;
  pathname: string;
}): TeamPage | null {
  if (findRetroSprintId({ teamId, pathname }) !== null) {
    return "retro";
  }
  return (
    TEAM_PAGES.find((page) => getTeamPagePath({ teamId, page }) === pathname) ??
    null
  );
}
