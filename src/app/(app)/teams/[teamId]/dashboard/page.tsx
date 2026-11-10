import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CalendarDays, Eye } from "lucide-react";
import { toSignInPath } from "@/lib/auth/sign-in-redirect";
import type { TeamRole } from "@/lib/auth/team-access";
import { computeRequirementStatus, summarizeRequirements } from "@/lib/checks";
import { buildActivityFeed } from "@/lib/dashboard/activity-feed";
import {
  getDaysLeft,
  getSprintState,
  getSprintWindow,
  selectSprint,
  type SprintRecord,
} from "@/lib/sprints";
import { countMemberActivity } from "@/lib/stats/member-activity";
import {
  ActivityFeed,
  type ActivityFeedEntryView,
} from "@/components/dashboard/activity-feed";
import {
  MemberCard,
  type MemberCardView,
} from "@/components/dashboard/member-card";
import { LiveAnnouncer } from "@/components/dashboard/live-announcer";
import { buildLiveUpdates } from "@/components/dashboard/live-updates";
import { RequirementSummary } from "@/components/dashboard/requirement-summary";
import { PageHeader } from "@/components/layout/page-header";
import { PageLoading } from "@/components/layout/page-loading";
import {
  formatDateRange,
  formatShortDate,
  readRequestedSprintId,
} from "@/components/layout/sprint-navigation";
import {
  EMPTY_STATE_LINK_CLASSES,
  EmptyState,
} from "@/components/ui/empty-state";
import { Pill } from "@/components/ui/pill";
import { requireTeamRole } from "@/server/auth";
import { getCurrentUser } from "@/server/current-user";
import { listTeamActivities } from "@/server/repositories/activities";
import { listTeamMembers } from "@/server/repositories/memberships";
import { listSprints } from "@/server/repositories/sprints";
import { listSprintStandups } from "@/server/repositories/standups";
import { findTeam } from "@/server/repositories/teams";

export const metadata: Metadata = { title: "Dashboard · SprintProof" };

type Params = Promise<{ teamId: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function displayName(user: {
  name: string | null;
  githubLogin: string | null;
}): string {
  return user.name ?? user.githubLogin ?? "GitHub user";
}

function pluralize(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

// computeRequirementStatus() takes sprint dates as the Dates Prisma reads from
// a DATE column, midnight UTC (AGENTS.md §1 Calendar dates: the known exception).
function toDbDate(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

function ReadOnlyPill() {
  return (
    <Pill>
      <Eye size={12} aria-hidden="true" />
      Read-only
    </Pill>
  );
}

export default function DashboardPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  return (
    <Suspense fallback={<PageLoading />}>
      <TeamDashboard params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function TeamDashboard({
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
      redirect(toSignInPath({ callbackPath: `/teams/${teamId}/dashboard` }));
    }
    // Same page as a team that doesn't exist, so outsiders learn nothing.
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
  const requestedSprintId = readRequestedSprintId(await searchParams);
  const sprint = selectSprint({
    sprints,
    requestedSprintId,
    now,
    timeZone: team.timezone,
  });
  const isReadOnly = access.role === "INSTRUCTOR";

  if (sprint === null) {
    return (
      <>
        <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 md:px-6">
          <PageHeader
            title="Dashboard"
            meta={`Days follow ${team.timezone}`}
            action={isReadOnly ? <ReadOnlyPill /> : null}
          />
          <EmptyState Icon={CalendarDays}>
            <p className="text-sm text-text-muted">
              No sprint has started yet.
            </p>
            {access.role === "LEAD" ? (
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
        </main>
      </>
    );
  }

  // The empty state above has nothing a teammate's standup or push could
  // change, so only a sprint's dashboard listens for live updates.
  return (
    <>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 md:px-6">
        {/* A new sprint remounts it: no count highlights or announcements for the switch. */}
        <SprintDashboard
          key={sprint.id}
          sprint={sprint}
          team={team}
          viewer={{ userId: user.id, role: access.role }}
          memberships={memberships}
          now={now}
        />
      </main>
    </>
  );
}

async function SprintDashboard({
  sprint,
  team,
  viewer,
  memberships,
  now,
}: {
  sprint: SprintRecord;
  team: { id: string; timezone: string };
  viewer: { userId: string; role: TeamRole };
  memberships: Awaited<ReturnType<typeof listTeamMembers>>;
  now: Date;
}) {
  const timeZone = team.timezone;
  const window = getSprintWindow({ sprint, timeZone });
  const [standups, activities] = await Promise.all([
    listSprintStandups({ sprint }),
    listTeamActivities({ teamId: team.id, from: window.start, to: window.end }),
  ]);

  // Instructors read the dashboard but have no requirements of their own.
  // The signed-in member's card comes first (AGENTS.md §2 Team dashboard).
  const contributors = memberships
    .filter((membership) => membership.role !== "INSTRUCTOR")
    .sort(
      (a, b) =>
        Number(b.user.id === viewer.userId) -
        Number(a.user.id === viewer.userId)
    );
  const members = contributors.map(({ user }) => ({
    userId: user.id,
    githubLogin: user.githubLogin,
  }));
  const statuses = computeRequirementStatus({
    sprint: {
      id: sprint.id,
      startDate: toDbDate(sprint.startDate),
      endDate: toDbDate(sprint.endDate),
      timezone: timeZone,
      standupsPerPerson: sprint.standupsPerPerson,
      reviewsPerPerson: sprint.reviewsPerPerson,
    },
    members,
    standups: standups.map(({ id, userId, createdAt }) => ({
      id,
      userId,
      createdAt,
    })),
    activities: activities.map((activity) => ({
      id: activity.id,
      type: activity.type,
      actorLogin: activity.actorLogin,
      prNumber: activity.prNumber,
      prAuthorLogin: activity.prAuthorLogin,
      createdAt: activity.occurredAt,
    })),
    now,
  });
  const counts = countMemberActivity({ sprint, timeZone, members, activities });
  const feed = buildActivityFeed({
    sprint,
    timeZone,
    members,
    standups,
    activities,
  });

  const isSprintRunning =
    getSprintState({ sprint, now, timeZone }) === "CURRENT";
  const cards: MemberCardView[] = contributors.map(({ user, role }, index) => ({
    userId: user.id,
    name: displayName(user),
    githubLogin: user.githubLogin,
    role,
    isViewer: user.id === viewer.userId,
    commits: counts[index].commits,
    pullRequests: counts[index].pullRequests,
    standups: statuses[index].standups,
    reviews: statuses[index].reviews,
  }));
  const viewerCard = cards.find((card) => card.isViewer) ?? null;

  const namesById = new Map(cards.map((card) => [card.userId, card.name]));
  // "Nov 3, 2:41 PM" in the team's timezone (DESIGN.md §9).
  const timeFormat = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  });
  const entries: ActivityFeedEntryView[] = feed.map((item) => ({
    ...item,
    actorName: namesById.get(item.userId) ?? "GitHub user",
    timeLabel: timeFormat.format(item.occurredAt),
  }));
  const canPost = viewer.role !== "INSTRUCTOR";

  return (
    <>
      <PageHeader
        title={sprint.name}
        meta={
          <>
            <span className="inline-flex items-center gap-1">
              <CalendarDays size={16} aria-hidden="true" />
              <span className="font-mono tabular-nums">
                {formatDateRange(sprint)}
              </span>
            </span>
            <span className="font-mono tabular-nums">
              {isSprintRunning
                ? `${pluralize(getDaysLeft({ sprint, now, timeZone }), "day")} left`
                : `Ended ${formatShortDate(sprint.endDate)}`}
            </span>
            <span>
              {pluralize(sprint.standupsPerPerson, "standup")} and{" "}
              {pluralize(sprint.reviewsPerPerson, "PR review")} per person
            </span>
          </>
        }
        action={viewer.role === "INSTRUCTOR" ? <ReadOnlyPill /> : null}
      />
      {viewerCard !== null && (
        <RequirementSummary
          summary={summarizeRequirements({
            sprintName: sprint.name,
            standups: viewerCard.standups,
            reviews: viewerCard.reviews,
            isSprintEnded: !isSprintRunning,
          })}
        />
      )}
      {/* DESIGN.md §6 Dashboard: cards span 2 columns in their own grid, the feed 1. */}
      <div className="grid items-start gap-4 lg:grid-cols-3">
        <div className="grid gap-4 md:grid-cols-2 lg:col-span-2">
          {cards.map((card) => (
            <MemberCard
              key={card.userId}
              member={card}
              isSprintRunning={isSprintRunning}
            />
          ))}
        </div>
        <ActivityFeed
          sprintName={sprint.name}
          entries={entries}
          postStandupHref={
            canPost && isSprintRunning ? `/teams/${team.id}/standups` : null
          }
        />
      </div>
      <LiveAnnouncer updates={buildLiveUpdates({ entries, cards })} />
    </>
  );
}
