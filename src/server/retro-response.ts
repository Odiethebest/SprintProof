import {
  MAX_VOTES_PER_RETRO,
  countVotesLeft,
  tallyRetroItems,
} from "@/lib/retro/retro-votes";
import { errorResponse } from "@/server/api-response";
import type {
  CarriedActionItemRecord,
  RetroItemRecord,
  RetroRecord,
} from "@/server/repositories/retros";

// The retro API's JSON shapes (docs/api/openapi.yaml: Retro, RetroItem,
// ActionItem) and its errors.

export function toRetroItemResponse(
  item: RetroItemRecord & { voteCount: number; hasVoted: boolean }
) {
  return {
    id: item.id,
    column: item.column,
    text: item.text,
    author: item.author,
    voteCount: item.voteCount,
    hasVoted: item.hasVoted,
    createdAt: item.createdAt,
  };
}

export function toActionItemResponse(
  actionItem: Pick<
    CarriedActionItemRecord,
    "id" | "sprintId" | "retroItemId" | "text" | "voteCount" | "isDone"
  >
) {
  return {
    id: actionItem.id,
    sprintId: actionItem.sprintId,
    retroItemId: actionItem.retroItemId,
    text: actionItem.text,
    voteCount: actionItem.voteCount,
    isDone: actionItem.isDone,
  };
}

// Items in vote order, with the caller's votes. Instructors don't vote, so
// they get null votes left.
export function toRetroResponse({
  retro,
  viewerId,
  canVote,
}: {
  retro: RetroRecord;
  viewerId: string;
  canVote: boolean;
}) {
  const items = tallyRetroItems({
    items: retro.items,
    votes: retro.votes,
    voterId: viewerId,
  });
  const actionItems = items.flatMap((item) => {
    const actionItem = retro.actionItems.find(
      (made) => made.retroItemId === item.id
    );
    return actionItem === undefined
      ? []
      : [
          toActionItemResponse({
            ...actionItem,
            text: item.text,
            voteCount: item.voteCount,
          }),
        ];
  });
  return {
    id: retro.id,
    sprintId: retro.sprintId,
    closedAt: retro.closedAt,
    createdAt: retro.createdAt,
    votesLeft: canVote
      ? countVotesLeft({ votes: retro.votes, voterId: viewerId })
      : null,
    items: items.map(toRetroItemResponse),
    actionItems,
  };
}

const RETRO_ERRORS = {
  RETRO_NOT_FOUND: {
    status: 404,
    code: "RETRO_NOT_FOUND",
    message: "The lead hasn't opened this sprint's retro yet.",
  },
  RETRO_CLOSED: {
    status: 409,
    code: "RETRO_CLOSED",
    message: "This retro is closed, so its items and votes can't change.",
  },
  ACTION_ITEMS_CLOSED: {
    status: 409,
    code: "RETRO_CLOSED",
    message: "This sprint's retro is closed, so its action items can't change.",
  },
  RETRO_EXISTS: {
    status: 409,
    code: "RETRO_EXISTS",
    message: "This sprint already has a retro.",
  },
  ITEM_NOT_FOUND: {
    status: 404,
    code: "RETRO_ITEM_NOT_FOUND",
    message: "Retro item not found.",
  },
  NO_VOTES_LEFT: {
    status: 409,
    code: "NO_VOTES_LEFT",
    message: `You've used your ${MAX_VOTES_PER_RETRO} votes in this retro. Take one back to vote for this item.`,
  },
  NO_NEXT_SPRINT: {
    status: 409,
    code: "NO_NEXT_SPRINT",
    message:
      "Add the next sprint in Settings first. Its action items come from this retro.",
  },
  ACTION_ITEM_NOT_FOUND: {
    status: 404,
    code: "ACTION_ITEM_NOT_FOUND",
    message: "Action item not found.",
  },
} as const;

export type RetroError = keyof typeof RETRO_ERRORS;

export function retroErrorResponse(error: RetroError): Response {
  return errorResponse(RETRO_ERRORS[error]);
}
