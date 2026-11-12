import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CalendarDays, Eye } from "lucide-react";
import { toSignInPath } from "@/lib/auth/sign-in-redirect";
import type { TeamRole } from "@/lib/auth/team-access";
import {
  buildSprintSummaryMarkdown,
  getExportAudience,
  type ExportRetro,
} from "@/lib/export/sprint-summary-markdown";
import { getSummaryFileName } from "@/lib/export/summary-file-name";
import { findNextSprint } from "@/lib/retro/next-sprint";
import { tallyRetroItems } from "@/lib/retro/retro-votes";
import {
  getSprintWindow,
  selectSprint,
  type SprintRecord,
} from "@/lib/sprints";
import { groupStandupsByDay } from "@/lib/standups/group-standups";
import { buildSprintSummary } from "@/lib/stats/sprint-summary";
import { REVIEW_ROLES } from "@/lib/teams/team-pages";
import { PageHeader } from "@/components/layout/page-header";
import { PageLoading } from "@/components/layout/page-loading";
import {
  buildSprintSelector,
  formatDateRange,
  formatShortDate,
  readRequestedSprintId,
} from "@/components/layout/sprint-navigation";
import { TeamShell } from "@/components/layout/team-shell";
import { ExportButton } from "@/components/review/export-button";
import {
  RequirementsTable,
  type RequirementRowView,
} from "@/components/review/requirements-table";
import {
  PeerFeedbackCard,
  PeerFeedbackLeftOutNote,
} from "@/components/review/peer-feedback-card";
import { ReviewRetroCard } from "@/components/review/review-retro-card";
import { ReviewStandups } from "@/components/review/review-standups";
import type { StandupDayView } from "@/components/standups/standup-history";
import {
  EMPTY_STATE_LINK_CLASSES,
  EmptyState,
} from "@/components/ui/empty-state";
import { Pill } from "@/components/ui/pill";
import { requireTeamRole } from "@/server/auth";
import { getCurrentUser } from "@/server/current-user";
import { listTeamActivities } from "@/server/repositories/activities";
import { listTeamMembers } from "@/server/repositories/memberships";
import { findRetro, type RetroRecord } from "@/server/repositories/retros";
import { listSprints } from "@/server/repositories/sprints";
import {
  listSprintStandups,
  type StandupWithAuthor,
} from "@/server/repositories/standups";
import { findTeam } from "@/server/repositories/teams";

export const metadata: Metadata = { title: "Review · SprintProof" };

type Params = Promise<{ teamId: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type Team = NonNullable<Awaited<ReturnType<typeof findTeam>>>;

// "Tue, Nov 3" for a YYYY-MM-DD date (DESIGN.md §9). The date is already the
// team's calendar day, so it's formatted in UTC to keep it from shifting.
const DAY_FORMAT = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

function pluralize(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function ReadOnlyPill() {
  return (
    <Pill>
      <Eye size={12} aria-hidden="true" />
      Read-only
    </Pill>
  );
}

export default function ReviewPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  return (
    <Suspense fallback={<PageLoading />}>
      <TeamReview params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function TeamReview({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { teamId } = await params;
  const access = await requireTeamRole(teamId, REVIEW_ROLES);
  if (!access.isAllowed) {
    if (access.status === 401) {
      redirect(toSignInPath({ callbackPath: `/review/${teamId}` }));
    }
    // A member gets the same page as a team that doesn't exist, as an
    // outsider does on any team page.
    notFound();
  }
  const [user, team, sprints, memberships] = await Promise.all([
    getCurrentUser(),
    findTeam({ teamId }),
    listSprints({ teamId }),
    listTeamMembers({ teamId }),
  ]);
  if (user === null || team === null) {
    notFound();
  }

  const now = new Date();
  const sprint = selectSprint({
    sprints,
    requestedSprintId: readRequestedSprintId(await searchParams),
    now,
    timeZone: team.timezone,
  });

  // Outside the team layout, so the page renders the same top bar itself.
  return (
    <TeamShell
      teamId={team.id}
      team={team}
      user={user}
      role={access.role}
      sprintSelector={buildSprintSelector({
        sprints,
        selectedId: sprint?.id ?? null,
        now,
        timeZone: team.timezone,
      })}
    >
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 md:px-6">
        {sprint === null ? (
          <NoSprintYet team={team} role={access.role} />
        ) : (
          <SprintReview
            key={sprint.id}
            sprint={sprint}
            sprints={sprints}
            team={team}
            memberships={memberships}
            role={access.role}
            viewerId={user.id}
            now={now}
          />
        )}
      </main>
    </TeamShell>
  );
}

function NoSprintYet({ team, role }: { team: Team; role: TeamRole }) {
  return (
    <>
      <PageHeader
        title="Review"
        meta={`Days follow ${team.timezone}`}
        action={<ReadOnlyPill />}
      />
      <EmptyState Icon={CalendarDays}>
        <p className="text-sm text-text-muted">No sprint has started yet.</p>
        {role === "LEAD" ? (
          <Link
            href={`/teams/${team.id}/settings`}
            className={EMPTY_STATE_LINK_CLASSES}
          >
            Add a sprint in Settings
          </Link>
        ) : (
          <p className="text-sm text-text-muted">
            A lead can add one in Settings.
          </p>
        )}
      </EmptyState>
    </>
  );
}

function toStandupDays({
  standups,
  timeZone,
}: {
  standups: StandupWithAuthor[];
  timeZone: string;
}): StandupDayView[] {
  // "9:05 AM" in the team's timezone (DESIGN.md §9).
  const timeFormat = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  });
  return groupStandupsByDay({ standups }).map((day) => ({
    date: day.date,
    dayLabel: DAY_FORMAT.format(new Date(`${day.date}T00:00:00.000Z`)),
    standups: day.standups.map((standup) => ({
      id: standup.id,
      authorName:
        standup.author.name ?? standup.author.githubLogin ?? "GitHub user",
      timeLabel: timeFormat.format(standup.createdAt),
      isEdited: standup.updatedAt.getTime() !== standup.createdAt.getTime(),
      yesterday: standup.yesterday,
      today: standup.today,
      blockers: standup.blockers,
    })),
  }));
}

// The retro as the review page and the export show it (#13): items in vote
// order, and the action items closing made, in the same order.
function toExportRetro({
  retro,
  sprint,
  sprints,
  viewerId,
}: {
  retro: RetroRecord | null;
  sprint: SprintRecord;
  sprints: SprintRecord[];
  viewerId: string;
}): ExportRetro | null {
  if (retro === null) {
    return null;
  }
  const items = tallyRetroItems({
    items: retro.items,
    votes: retro.votes,
    voterId: viewerId,
  });
  const actionItems = items.flatMap((item) => {
    const made = retro.actionItems.find(
      (actionItem) => actionItem.retroItemId === item.id
    );
    return made === undefined ? [] : [{ text: item.text, isDone: made.isDone }];
  });
  // Where closing put the action items, or the sprint that starts next.
  const madeFor = sprints.find(
    (other) => other.id === retro.actionItems.at(0)?.sprintId
  );
  const nextSprint = madeFor ?? findNextSprint({ sprint, sprints });
  return {
    closedAt: retro.closedAt,
    items: items.map(({ column, text, voteCount }) => ({
      column,
      text,
      voteCount,
    })),
    nextSprintName: nextSprint?.name ?? null,
    actionItems,
  };
}

// The same reads and counts as GET .../sprints/{sprintId}/summary.
async function SprintReview({
  sprint,
  sprints,
  team,
  memberships,
  role,
  viewerId,
  now,
}: {
  sprint: SprintRecord;
  sprints: SprintRecord[];
  team: Team;
  memberships: Awaited<ReturnType<typeof listTeamMembers>>;
  role: TeamRole;
  viewerId: string;
  now: Date;
}) {
  const timeZone = team.timezone;
  const window = getSprintWindow({ sprint, timeZone });
  const [standups, activities, retroRecord] = await Promise.all([
    listSprintStandups({ sprint }),
    listTeamActivities({ teamId: team.id, from: window.start, to: window.end }),
    findRetro({ sprintId: sprint.id }),
  ]);
  const retro = toExportRetro({
    retro: retroRecord,
    sprint,
    sprints,
    viewerId,
  });
  const summary = buildSprintSummary({
    sprint,
    timeZone,
    members: memberships.map(({ role: memberRole, user }) => ({
      userId: user.id,
      name: user.name,
      githubLogin: user.githubLogin,
      role: memberRole,
    })),
    standups: standups.map(({ id, userId, date }) => ({ id, userId, date })),
    activities,
    now,
  });
  const audience = getExportAudience({ role });
  const rows: RequirementRowView[] = summary.members.map((member) => ({
    userId: member.userId,
    name: member.name ?? member.githubLogin ?? "GitHub user",
    githubLogin: member.githubLogin,
    standups: member.standups,
    reviews: member.reviews,
    commits: member.commits,
    pullRequests: member.pullRequests,
  }));
  // "Nov 3" in the team's timezone (DESIGN.md §9).
  const countsAsOfLabel = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone,
  }).format(summary.countsAsOf);
  // The selector lists only sprints that have started, so a sprint here is
  // running or has ended; days left is null only before a start (#92).
  const daysLeft =
    summary.sprint.state === "CURRENT" ? summary.sprint.daysLeft : null;

  return (
    <>
      <PageHeader
        title={`${sprint.name} review`}
        meta={
          <>
            <span className="inline-flex items-center gap-1">
              <CalendarDays size={16} aria-hidden="true" />
              <span className="font-mono tabular-nums">
                {formatDateRange(sprint)}
              </span>
            </span>
            <span className="font-mono tabular-nums">
              {daysLeft === null
                ? `Ended ${formatShortDate(sprint.endDate)}`
                : `${pluralize(daysLeft, "day")} left`}
            </span>
            <span>
              {pluralize(sprint.standupsPerPerson, "standup")} and{" "}
              {pluralize(sprint.reviewsPerPerson, "PR review")} per person
            </span>
            <ReadOnlyPill />
          </>
        }
        action={
          <ExportButton
            fileName={getSummaryFileName({ sprint, sprints })}
            markdown={buildSprintSummaryMarkdown({
              team,
              summary,
              standups,
              audience,
              retro,
            })}
            audience={audience}
          />
        }
      />
      <RequirementsTable rows={rows} countsAsOfLabel={countsAsOfLabel} />
      {/* DESIGN.md §6 Review: standups and retro side by side. */}
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <ReviewStandups
          sprintName={sprint.name}
          days={toStandupDays({ standups, timeZone })}
        />
        <ReviewRetroCard sprintName={sprint.name} retro={retro} />
      </div>
      {/* Peer feedback only ever reaches instructors (AGENTS.md §1, PRD R7). */}
      {audience === "INSTRUCTOR" ? (
        <PeerFeedbackCard />
      ) : (
        <PeerFeedbackLeftOutNote />
      )}
    </>
  );
}
