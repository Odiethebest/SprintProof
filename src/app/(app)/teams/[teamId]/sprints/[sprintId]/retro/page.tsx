import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { ClipboardList, Lock, ThumbsUp } from "lucide-react";
import { toSignInPath } from "@/lib/auth/sign-in-redirect";
import { findNextSprint } from "@/lib/retro/next-sprint";
import {
  MAX_VOTES_PER_RETRO,
  countVotesLeft,
  selectActionItems,
  tallyRetroItems,
} from "@/lib/retro/retro-votes";
import type { SprintRecord } from "@/lib/sprints";
import { PageHeader } from "@/components/layout/page-header";
import { PageLoading } from "@/components/layout/page-loading";
import {
  ActionItemsPanel,
  type ActionItemView,
  type RetroState,
} from "@/components/retro/action-items-panel";
import {
  RetroColumn,
  type RetroColumnMode,
  type RetroItemView,
} from "@/components/retro/retro-column";
import { RetroLeadControls } from "@/components/retro/retro-lead-controls";
import { EmptyState } from "@/components/ui/empty-state";
import { PageAnnouncer } from "@/components/ui/page-announcer";
import { Pill } from "@/components/ui/pill";
import { requireTeamRole } from "@/server/auth";
import { getCurrentUser } from "@/server/current-user";
import {
  findRetro,
  listCarriedActionItems,
  type RetroRecord,
} from "@/server/repositories/retros";
import { listSprints } from "@/server/repositories/sprints";

export const metadata: Metadata = { title: "Retro · SprintProof" };

type Params = Promise<{ teamId: string; sprintId: string }>;

export default function RetroPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<PageLoading />}>
      <SprintRetro params={params} />
    </Suspense>
  );
}

function getRetroState(retro: RetroRecord | null): RetroState {
  if (retro === null) {
    return "NOT_OPENED";
  }
  return retro.closedAt === null ? "OPEN" : "CLOSED";
}

// The sprint the retro's action items go to: where closing put them, or the
// sprint that starts next (rule R6).
function getNextSprint({
  retro,
  sprint,
  sprints,
}: {
  retro: RetroRecord | null;
  sprint: SprintRecord;
  sprints: SprintRecord[];
}): SprintRecord | null {
  const madeFor = retro?.actionItems.at(0)?.sprintId;
  const stored = sprints.find((other) => other.id === madeFor);
  return stored ?? findNextSprint({ sprint, sprints });
}

function VotesLeftPill({ votesLeft }: { votesLeft: number }) {
  // DESIGN.md §7 Pill: the votes-left counter is h-9 px-3 text-sm.
  return (
    <span className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full border border-border px-3 text-sm text-text-muted">
      <ThumbsUp size={16} aria-hidden="true" />
      {votesLeft} of {MAX_VOTES_PER_RETRO} votes left
    </span>
  );
}

// AGENTS.md §2 Retro: action items, then "Went well" and "To improve".
async function SprintRetro({ params }: { params: Params }) {
  const { teamId, sprintId } = await params;
  const access = await requireTeamRole(teamId, [
    "LEAD",
    "MEMBER",
    "INSTRUCTOR",
  ]);
  if (!access.isAllowed) {
    if (access.status === 401) {
      redirect(
        toSignInPath({
          callbackPath: `/teams/${teamId}/sprints/${sprintId}/retro`,
        })
      );
    }
    // Same page as a team that doesn't exist, so outsiders learn nothing.
    notFound();
  }
  const [user, sprints] = await Promise.all([
    getCurrentUser(),
    listSprints({ teamId }),
  ]);
  const sprint = sprints.find((other) => other.id === sprintId);
  if (user === null || sprint === undefined) {
    notFound();
  }
  const [retro, carried] = await Promise.all([
    findRetro({ sprintId }),
    listCarriedActionItems({ sprintId }),
  ]);

  const retroState = getRetroState(retro);
  const isLead = access.role === "LEAD";
  // Instructors read the retro but don't take part (AGENTS.md §1 roles).
  const canTakePart = access.role !== "INSTRUCTOR";
  const nextSprint = getNextSprint({ retro, sprint, sprints });
  const items =
    retro === null
      ? []
      : tallyRetroItems({
          items: retro.items,
          votes: retro.votes,
          voterId: user.id,
        });
  const votesLeft =
    retro === null
      ? 0
      : countVotesLeft({ votes: retro.votes, voterId: user.id });
  const toItemView = (item: (typeof items)[number]): RetroItemView => ({
    id: item.id,
    text: item.text,
    authorName: item.author.name ?? item.author.githubLogin ?? "GitHub user",
    voteCount: item.voteCount,
    hasVoted: item.hasVoted,
  });
  const preview =
    retro === null
      ? []
      : selectActionItems({ items: retro.items, votes: retro.votes });
  const nextItems: ActionItemView[] =
    retroState === "CLOSED"
      ? items.flatMap((item) => {
          const made = retro?.actionItems.find(
            (actionItem) => actionItem.retroItemId === item.id
          );
          return made === undefined
            ? []
            : [
                {
                  id: made.id,
                  text: item.text,
                  voteCount: item.voteCount,
                  isDone: made.isDone,
                },
              ];
        })
      : preview.map((item) => ({
          id: item.id,
          text: item.text,
          voteCount: item.voteCount,
          isDone: false,
        }));
  const columnMode: RetroColumnMode =
    retroState === "OPEN" && canTakePart
      ? { kind: "OPEN", teamId, sprintId, votesLeft }
      : { kind: "READ_ONLY" };

  return (
    <PageAnnouncer>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 md:px-6">
        <PageHeader
          title={`${sprint.name} retro`}
          meta={
            <>
              {retroState === "OPEN" && <Pill>Open</Pill>}
              {retroState === "CLOSED" && (
                <Pill>
                  <Lock size={12} aria-hidden="true" />
                  Closed
                </Pill>
              )}
              <span>{MAX_VOTES_PER_RETRO} votes each, 1 per item</span>
            </>
          }
          action={
            <div className="flex flex-wrap items-center gap-2">
              {columnMode.kind === "OPEN" && (
                <VotesLeftPill votesLeft={votesLeft} />
              )}
              {isLead && (
                <RetroLeadControls
                  teamId={teamId}
                  sprintId={sprintId}
                  sprintName={sprint.name}
                  retroState={retroState}
                  nextSprintName={nextSprint?.name ?? null}
                  closingItems={preview.map(({ id, text }) => ({ id, text }))}
                />
              )}
            </div>
          }
        />
        <ActionItemsPanel
          sprintName={sprint.name}
          carried={carried.map((actionItem) => ({
            id: actionItem.id,
            text: actionItem.text,
            voteCount: actionItem.voteCount,
            isDone: actionItem.isDone,
          }))}
          carriedFrom={carried.map((actionItem) => actionItem.fromSprintName)}
          // Checked off during the sprint, until its own retro closes.
          checkboxes={
            canTakePart && retroState !== "CLOSED" ? { teamId, sprintId } : null
          }
          retroState={retroState}
          nextSprintName={nextSprint?.name ?? null}
          nextItems={nextItems}
          addSprintHref={isLead ? `/teams/${teamId}/settings` : null}
        />
        {retro === null ? (
          <EmptyState Icon={ClipboardList}>
            <p className="text-sm text-text-muted">
              {isLead
                ? "Open the retro so the team can add items and vote."
                : `The lead hasn't opened the ${sprint.name} retro yet.`}
            </p>
          </EmptyState>
        ) : (
          // DESIGN.md §6 Retro: the two columns side by side from md.
          <div className="grid items-start gap-4 md:grid-cols-2">
            <RetroColumn
              column="WENT_WELL"
              items={items
                .filter((item) => item.column === "WENT_WELL")
                .map(toItemView)}
              mode={columnMode}
            />
            <RetroColumn
              column="TO_IMPROVE"
              items={items
                .filter((item) => item.column === "TO_IMPROVE")
                .map(toItemView)}
              mode={columnMode}
            />
          </div>
        )}
      </main>
    </PageAnnouncer>
  );
}
