import type { LiveUpdateView } from "@/components/dashboard/live-announcer";

export interface StandupChangeView {
  id: string;
  userId: string;
  authorName: string;
  updatedAt: Date;
  isEdited: boolean;
}

// What the Standups page announces when a teammate posts or edits a standup
// (AGENTS.md §2 LiveIndicator), newest change first. The viewer's own
// standups are left out: the form already confirms those ("Standup posted.").
export function buildStandupLiveUpdates({
  standups,
  viewerId,
}: {
  standups: StandupChangeView[];
  viewerId: string;
}): LiveUpdateView[] {
  return standups
    .filter((standup) => standup.userId !== viewerId)
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .map((standup) => ({
      // An edit changes updatedAt, so it counts as a new item to announce.
      key: `${standup.id}:${standup.updatedAt.getTime()}`,
      message: `${standup.authorName} ${standup.isEdited ? "updated" : "posted"} a standup.`,
    }));
}
