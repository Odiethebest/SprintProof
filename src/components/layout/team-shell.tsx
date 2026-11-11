"use client";

import type { ReactNode, ComponentProps } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import type { TeamRole } from "@/lib/auth/team-access";
import { LIVE_PAGES, SPRINT_PAGES, findTeamPage } from "@/lib/teams/team-pages";
import { AppHeader } from "./app-header";
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
  sprintSelector: Header["sprintSelector"];
  children: ReactNode;
}) {
  const pathname = usePathname();
  const query = useSearchParams();
  // A team path the navigation doesn't list marks no link as current and shows
  // no sprint selector (#93).
  const current = findTeamPage({ teamId, pathname });
  const isSprintPage = current !== null && SPRINT_PAGES.includes(current);
  const isLivePage = current !== null && LIVE_PAGES.includes(current);
  const requested = query.getAll("sprint");
  const requestedSprintId =
    requested.length === 1 &&
    sprintSelector?.options.some((option) => option.id === requested[0])
      ? requested[0]
      : null;
  const content = (
    <>
      <AppHeader
        team={team}
        user={user}
        role={role}
        teamNav={{ teamId, role, current, requestedSprintId }}
        sprintSelector={
          !isSprintPage || sprintSelector === null
            ? null
            : {
                ...sprintSelector,
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
