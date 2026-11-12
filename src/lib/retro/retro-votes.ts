// Retro votes (AGENTS.md §1, PRD rule R6): each member gets 3 votes per retro,
// at most 1 per item. The top 3 "To improve" items by votes, ties broken by
// the earliest created, become the next sprint's action items.
export const MAX_VOTES_PER_RETRO = 3;
export const ACTION_ITEMS_PER_RETRO = 3;

export type RetroColumn = "WENT_WELL" | "TO_IMPROVE";

export interface RetroItemInput {
  id: string;
  column: RetroColumn;
  createdAt: Date;
}

// One member's vote on one item, all from the same retro.
export interface RetroVoteInput {
  itemId: string;
  userId: string;
}

export interface SortableRetroItem {
  id: string;
  createdAt: Date;
  voteCount: number;
}

// "ADD" and "REMOVE" change the stored votes; "UNCHANGED" means the vote is
// already as asked; "NO_VOTES_LEFT" refuses a vote past the 3 per retro.
export type VoteDecision = "ADD" | "REMOVE" | "UNCHANGED" | "NO_VOTES_LEFT";

function countVotesByItem(
  votes: readonly RetroVoteInput[]
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const vote of votes) {
    counts.set(vote.itemId, (counts.get(vote.itemId) ?? 0) + 1);
  }
  return counts;
}

function hasVotedFor({
  votes,
  voterId,
  itemId,
}: {
  votes: readonly RetroVoteInput[];
  voterId: string;
  itemId: string;
}): boolean {
  return votes.some(
    (vote) => vote.itemId === itemId && vote.userId === voterId
  );
}

// Most votes first; ties go to the earliest created (rule R6). The id breaks
// a tie on both, so the order never depends on how the items were read.
export function sortRetroItems<T extends SortableRetroItem>({
  items,
}: {
  items: readonly T[];
}): T[] {
  return [...items].sort(
    (a, b) =>
      b.voteCount - a.voteCount ||
      a.createdAt.getTime() - b.createdAt.getTime() ||
      a.id.localeCompare(b.id)
  );
}

// Each item with its vote count and whether the voter voted for it, sorted
// as the retro columns list them.
export function tallyRetroItems<T extends RetroItemInput>({
  items,
  votes,
  voterId,
}: {
  items: readonly T[];
  votes: readonly RetroVoteInput[];
  voterId: string;
}): Array<T & { voteCount: number; hasVoted: boolean }> {
  const counts = countVotesByItem(votes);
  return sortRetroItems({
    items: items.map((item) => ({
      ...item,
      voteCount: counts.get(item.id) ?? 0,
      hasVoted: hasVotedFor({ votes, voterId, itemId: item.id }),
    })),
  });
}

// The "To improve" items that become the next sprint's action items when the
// retro closes, in order. Fewer than 3 items means all of them.
export function selectActionItems<T extends RetroItemInput>({
  items,
  votes,
}: {
  items: readonly T[];
  votes: readonly RetroVoteInput[];
}): Array<T & { voteCount: number }> {
  const counts = countVotesByItem(votes);
  const toImprove = items
    .filter((item) => item.column === "TO_IMPROVE")
    .map((item) => ({ ...item, voteCount: counts.get(item.id) ?? 0 }));
  return sortRetroItems({ items: toImprove }).slice(0, ACTION_ITEMS_PER_RETRO);
}

export function countVotesLeft({
  votes,
  voterId,
}: {
  votes: readonly RetroVoteInput[];
  voterId: string;
}): number {
  const used = votes.filter((vote) => vote.userId === voterId).length;
  return Math.max(0, MAX_VOTES_PER_RETRO - used);
}

// What a vote request does: isVoting true asks for the voter's vote on the
// item, false takes it back. Taking a vote back is always allowed.
export function decideVote({
  votes,
  voterId,
  itemId,
  isVoting,
}: {
  votes: readonly RetroVoteInput[];
  voterId: string;
  itemId: string;
  isVoting: boolean;
}): VoteDecision {
  const hasVoted = hasVotedFor({ votes, voterId, itemId });
  if (!isVoting) {
    return hasVoted ? "REMOVE" : "UNCHANGED";
  }
  if (hasVoted) {
    return "UNCHANGED";
  }
  return countVotesLeft({ votes, voterId }) === 0 ? "NO_VOTES_LEFT" : "ADD";
}
