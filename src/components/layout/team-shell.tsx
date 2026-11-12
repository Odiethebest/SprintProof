"use client";

import type { ReactNode, ComponentProps } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import type { TeamRole } from "@/lib/auth/team-access";
import {
  LIVE_PAGES,
  SPRINT_PAGES,
  findRetroSprintId,
  findTeamPage,
  getSprintPagePath,
} from "@/lib/teams/team-pages";
import { AppHeader } from "./app-header";
import type { SprintOptionView } from "./sprint-selector";
import { TeamLiveProvider } from "@/components/realtime/team-live-provider";

type Header = ComponentProps<typeof AppHeader>;

export function TeamShell({
  teamId,
  team,
  user,
  role,
  sprintSelector,
  children,
}: {
  teamId: string;
  team: Header["team"];
  user: Header["user"];
  role: TeamRole;
  sprintSelector: { options: SprintOptionView[]; selectedId: string } | null;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const query = useSearchParams();
  // A team path the navigation doesn't list marks no link as current and shows
  // no sprint selector (#93).
  const current = findTeamPage({ teamId, pathname });
  const isSprintPage = current !== null && SPRINT_PAGES.includes(current);
  const isLivePage = current !== null && LIVE_PAGES.includes(current);
  // A sprint's retro names its sprint in the path; other pages in `?sprint=`.
  const retroSprintId = findRetroSprintId({ teamId, pathname });
  const requested =
    retroSprintId === null ? query.getAll("sprint") : [retroSprintId];
  const requestedSprintId =
    requested.length === 1 &&
    sprintSelector?.options.some((option) => option.id === requested[0])
      ? requested[0]
      : null;
  // The selector lists started sprints only, so the retro of an upcoming
  // sprint has nothing in it to show as selected.
  const isUnlistedRetro = retroSprintId !== null && requestedSprintId === null;
  // Retro in the navigation opens the shown sprint's retro (#13).
  const shownSprintId = requestedSprintId ?? sprintSelector?.selectedId ?? null;
  const content = (
    <>
      <AppHeader
        team={team}
        user={user}
        role={role}
        teamNav={{
          teamId,
          role,
          current,
          requestedSprintId,
          retroSprintId: shownSprintId,
        }}
        sprintSelector={
          current === null ||
          !isSprintPage ||
          isUnlistedRetro ||
          sprintSelector === null
            ? null
            : {
                options: sprintSelector.options.map((option) => ({
                  ...option,
                  href: getSprintPagePath({
                    teamId,
                    page: current,
                    sprintId: option.id,
                  }),
                })),
                selectedId: requestedSprintId ?? sprintSelector.selectedId,
              }
        }
      />
      {children}
    </>
  );
  return isLivePage ? (
    <TeamLiveProvider teamId={teamId}>{content}</TeamLiveProvider>
  ) : (
    content
  );
}
