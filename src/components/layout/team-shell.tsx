"use client";

import type { ReactNode, ComponentProps } from "react";
import { usePathname, useSearchParams } from "next/navigation";
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
  role: Header["role"];
  sprintSelector: Header["sprintSelector"];
  children: ReactNode;
}) {
  const pathname = usePathname();
  const query = useSearchParams();
  const current = pathname.endsWith("/settings")
    ? "settings"
    : pathname.endsWith("/standups")
      ? "standups"
      : "dashboard";
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
        teamNav={{ teamId, current, requestedSprintId }}
        sprintSelector={
          current === "settings" || sprintSelector === null
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
  return current === "settings" ? (
    content
  ) : (
    <TeamLiveProvider teamId={teamId}>{content}</TeamLiveProvider>
  );
}
