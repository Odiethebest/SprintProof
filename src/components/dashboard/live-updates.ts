import type { RequirementProgress } from "@/lib/checks";
import { describeAction, type ActivityFeedEntryView } from "./activity-feed";
import type { LiveUpdateView } from "./live-announcer";
import type { MemberCardView } from "./member-card";
import { STATUS_DISPLAY } from "./status-label";

// A commit group keeps its id for the whole day, so its count is part of the key.
function toUpdateKey(entry: ActivityFeedEntryView): string {
  return entry.kind === "COMMITS"
    ? `${entry.id}:${entry.commitCount}`
    : entry.id;
}

function describeProgress(
  label: string,
  progress: RequirementProgress
): string {
  const status = STATUS_DISPLAY[progress.status].label.toLowerCase();
  return ` ${label} ${progress.count} of ${progress.required}, ${status}.`;
}

// Standups and reviews count toward a requirement, so the announcement says
// where the actor stands; commits and opened PRs have no requirement.
function describeRequirement(
  entry: ActivityFeedEntryView,
  card: MemberCardView | undefined
): string {
  if (card === undefined) {
    return "";
  }
  switch (entry.kind) {
    case "STANDUP":
      return describeProgress("Standups", card.standups);
    case "REVIEW":
      return describeProgress("PR reviews", card.reviews);
    case "PR_OPENED":
    case "COMMITS":
      return "";
  }
}

// What the dashboard announces for each feed item, e.g. "Ziqi (Odie) Yang
// posted a standup. Standups 1 of 3, on track." (AGENTS.md §2 LiveIndicator).
export function buildLiveUpdates({
  entries,
  cards,
}: {
  entries: ActivityFeedEntryView[];
  cards: MemberCardView[];
}): LiveUpdateView[] {
  const cardsById = new Map(cards.map((card) => [card.userId, card]));
  return entries.map((entry) => ({
    key: toUpdateKey(entry),
    message:
      `${entry.actorName} ${describeAction(entry)}.` +
      describeRequirement(entry, cardsById.get(entry.userId)),
  }));
}
