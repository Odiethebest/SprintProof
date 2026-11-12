"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ThumbsUp } from "lucide-react";
import { z } from "zod";
import { MAX_VOTES_PER_RETRO } from "@/lib/retro/retro-votes";
import {
  NETWORK_ERROR_MESSAGE,
  readApiError,
} from "@/components/teams/api-error";
import { useAnnounce } from "@/components/ui/page-announcer";

const voteStateSchema = z.object({ votesLeft: z.number() });

// DESIGN.md §7 VoteButton: 36 px, filled when the user voted, 60% opacity
// with no votes left.
const BUTTON_CLASSES = {
  voted:
    "inline-flex h-9 min-w-9 shrink-0 items-center justify-center gap-1 rounded-md border border-primary bg-primary/10 px-2 text-sm text-primary transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
  open: "inline-flex h-9 min-w-9 shrink-0 items-center justify-center gap-1 rounded-md border border-border bg-surface px-2 text-sm transition-colors duration-150 ease-out hover:bg-text/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
  noVotesLeft:
    "inline-flex h-9 min-w-9 shrink-0 cursor-not-allowed items-center justify-center gap-1 rounded-md border border-border bg-surface px-2 text-sm opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
} as const;

function pluralizeVotes(count: number): string {
  return `${count} vote${count === 1 ? "" : "s"}`;
}

// The vote count of an item that can't be voted on: a closed retro, or an
// instructor's view.
export function VoteCount({ count }: { count: number }) {
  return (
    <span className="inline-flex h-9 shrink-0 items-center gap-1 px-2 text-sm text-text-muted">
      <ThumbsUp size={16} aria-hidden="true" />
      <span className="font-mono tabular-nums">{count}</span>
      <span className="sr-only">{count === 1 ? " vote" : " votes"}</span>
    </span>
  );
}

// AGENTS.md §2 VoteButton: toggles the user's vote (aria-pressed). With no
// votes left, an item they haven't voted for is aria-disabled and says why.
export function VoteButton({
  teamId,
  sprintId,
  itemId,
  itemText,
  voteCount,
  hasVoted,
  votesLeft,
}: {
  teamId: string;
  sprintId: string;
  itemId: string;
  itemText: string;
  voteCount: number;
  hasVoted: boolean;
  votesLeft: number;
}) {
  const router = useRouter();
  const announce = useAnnounce();
  const [isSending, setIsSending] = useState(false);
  const [isRefreshing, startRefresh] = useTransition();
  const countId = useId();
  const tooltipId = useId();
  const hasNoVotesLeft = !hasVoted && votesLeft === 0;

  async function toggleVote() {
    if (hasNoVotesLeft || isSending || isRefreshing) {
      return;
    }
    setIsSending(true);
    try {
      const response = await fetch(
        `/api/v1/teams/${teamId}/sprints/${sprintId}/retro/items/${itemId}/vote`,
        { method: hasVoted ? "DELETE" : "PUT" }
      );
      if (response.ok) {
        const state = voteStateSchema.safeParse(await response.json());
        const left = state.success ? state.data.votesLeft : votesLeft;
        announce(
          `${hasVoted ? "Vote taken back" : "Vote added"}. ${left} of ${MAX_VOTES_PER_RETRO} votes left.`
        );
      } else {
        announce((await readApiError(response)).message);
      }
      // The counts come from the server, including teammates' new votes.
      startRefresh(() => router.refresh());
    } catch {
      announce(NETWORK_ERROR_MESSAGE);
    }
    setIsSending(false);
  }

  const className = hasVoted
    ? BUTTON_CLASSES.voted
    : hasNoVotesLeft
      ? BUTTON_CLASSES.noVotesLeft
      : BUTTON_CLASSES.open;
  return (
    <span className="group relative inline-flex shrink-0">
      {/* Named "Vote for <item>" from its content, which stays the same as
        the count changes; the count is read as its description. */}
      <button
        type="button"
        aria-pressed={hasVoted}
        aria-disabled={hasNoVotesLeft ? true : undefined}
        aria-describedby={hasNoVotesLeft ? `${countId} ${tooltipId}` : countId}
        onClick={toggleVote}
        className={className}
      >
        <ThumbsUp
          size={16}
          aria-hidden="true"
          fill={hasVoted ? "currentColor" : "none"}
        />
        <span aria-hidden="true" className="font-mono tabular-nums">
          {voteCount}
        </span>
        <span className="sr-only">Vote for {itemText}</span>
      </button>
      <span id={countId} className="sr-only">
        {pluralizeVotes(voteCount)}
      </span>
      {hasNoVotesLeft && (
        // DESIGN.md §7 Tooltip: shown on hover and keyboard focus.
        <span
          id={tooltipId}
          role="tooltip"
          className="pointer-events-none absolute right-0 top-full z-10 mt-1 hidden whitespace-nowrap rounded-md bg-text px-2 py-1 text-xs text-canvas group-focus-within:block group-hover:block"
        >
          No votes left
        </span>
      )}
    </span>
  );
}
