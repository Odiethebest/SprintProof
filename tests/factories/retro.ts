import type { RetroItemInput, RetroVoteInput } from "@/lib/retro/retro-votes";

let retroItemSeq = 1;

export function resetRetroItemSeq(): void {
  retroItemSeq = 1;
}

// A retro item as the vote rules take it, plus its text. Each new item is
// created a minute after the one before, so the creation order is the call order.
export interface RetroItemEntry extends RetroItemInput {
  text: string;
}

export function createRetroItem(
  overrides: Partial<RetroItemEntry> = {}
): RetroItemEntry {
  const n = retroItemSeq++;
  return {
    id: `retro-item-${n}`,
    column: "TO_IMPROVE",
    text: `Retro item ${n}`,
    createdAt: new Date(Date.UTC(2026, 10, 3, 17, n)),
    ...overrides,
  };
}

// One vote from each user on the item.
export function createRetroVotes({
  itemId,
  userIds,
}: {
  itemId: string;
  userIds: string[];
}): RetroVoteInput[] {
  return userIds.map((userId) => ({ itemId, userId }));
}
