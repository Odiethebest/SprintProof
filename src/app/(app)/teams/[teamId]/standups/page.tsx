import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { toSignInPath } from "@/lib/auth/sign-in-redirect";
import { getCurrentSprint, selectSprint } from "@/lib/sprints";
import { groupStandupsByDay } from "@/lib/standups/group-standups";
import { getStandupDate } from "@/lib/standups/standup-date";
import { PageHeader } from "@/components/layout/page-header";
import { PageLoading } from "@/components/layout/page-loading";
import { readRequestedSprintId } from "@/components/layout/sprint-navigation";
import { StandupForm } from "@/components/standups/standup-form";
import {
  StandupHistory,
  type StandupEntryView,
} from "@/components/standups/standup-history";
import { requireTeamRole } from "@/server/auth";
import { getCurrentUser } from "@/server/current-user";
import { listSprints } from "@/server/repositories/sprints";
import {
  findStandup,
  listSprintStandups,
  type StandupWithAuthor,
} from "@/server/repositories/standups";
import { findTeam } from "@/server/repositories/teams";

export const metadata: Metadata = { title: "Standups · SprintProof" };

type Params = Promise<{ teamId: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

// "Tue, Nov 3" for a YYYY-MM-DD date (DESIGN.md §9). The date is already the
// team's calendar day, so it's formatted in UTC to keep it from shifting.
const DAY_FORMAT = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

function formatDay(date: string): string {
  return DAY_FORMAT.format(new Date(`${date}T00:00:00.000Z`));
}

export default function StandupsPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  return (
    <Suspense fallback={<PageLoading />}>
      <TeamStandups params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function TeamStandups({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { teamId } = await params;
  const access = await requireTeamRole(teamId, [
    "LEAD",
    "MEMBER",
    "INSTRUCTOR",
  ]);
  if (!access.isAllowed) {
    if (access.status === 401) {
      redirect(toSignInPath({ callbackPath: `/teams/${teamId}/standups` }));
    }
    // Same page as a team that doesn't exist, so outsiders learn nothing.
    notFound();
  }
  const [user, team, sprints] = await Promise.all([
    getCurrentUser(),
    findTeam({ teamId }),
    listSprints({ teamId }),
  ]);
  if (user === null || team === null) {
    notFound();
  }

  const now = new Date();
  const sprint = getCurrentSprint({ sprints, now, timeZone: team.timezone });
  // History follows the sprint selector; the form always files under the
  // current sprint (AGENTS.md §2 StandupForm).
  const requestedSprintId = readRequestedSprintId(await searchParams);
  const historySprint = selectSprint({
    sprints,
    requestedSprintId,
    now,
    timeZone: team.timezone,
  });
  const today = getStandupDate({ now, timezone: team.timezone });
  // Instructors read standups but don't post them (AGENTS.md §2 Standups).
  const canPost = access.role !== "INSTRUCTOR";
  const [standups, saved] = await Promise.all([
    historySprint === null ? [] : listSprintStandups({ sprint: historySprint }),
    canPost && sprint !== null
      ? findStandup({ sprint, userId: user.id, date: today })
      : null,
  ]);

  // "9:05 AM" in the team's timezone (DESIGN.md §9).
  const timeFormat = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: team.timezone,
  });
  const toEntryView = (standup: StandupWithAuthor): StandupEntryView => ({
    id: standup.id,
    authorName:
      standup.author.name ?? standup.author.githubLogin ?? "GitHub user",
    timeLabel: timeFormat.format(standup.createdAt),
    isEdited: standup.updatedAt.getTime() !== standup.createdAt.getTime(),
    yesterday: standup.yesterday,
    today: standup.today,
    blockers: standup.blockers,
  });
  const days = groupStandupsByDay({ standups }).map((day) => ({
    date: day.date,
    dayLabel: formatDay(day.date),
    standups: day.standups.map(toEntryView),
  }));

  // Teammates' standups show up in History without a reload.
  return (
    <>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 md:px-6">
        <PageHeader
          title="Standups"
          meta={`One standup per person per day · Days follow ${team.timezone}`}
          action={null}
        />
        {/* DESIGN.md §6 Standups: form 1 column, history 2; instructors get the history only. */}
        <div className="grid items-start gap-4 lg:grid-cols-3">
          {canPost && (
            <StandupForm
              formDate={today}
              teamId={team.id}
              dateLabel={formatDay(today)}
              sprintName={sprint?.name ?? null}
              saved={
                saved === null
                  ? null
                  : {
                      yesterday: saved.yesterday,
                      today: saved.today,
                      blockers: saved.blockers,
                      postedAtLabel: timeFormat.format(saved.createdAt),
                    }
              }
            />
          )}
          <div className={canPost ? "lg:col-span-2" : "lg:col-span-3"}>
            <StandupHistory
              sprintName={historySprint?.name ?? null}
              days={days}
              canPost={canPost && sprint !== null && historySprint === sprint}
            />
          </div>
        </div>
      </main>
    </>
  );
}
