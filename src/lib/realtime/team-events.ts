// Real-time flow: each team has one channel, and an event only says what
// changed. Clients refetch; records never go through Pusher (AGENTS.md §1).
export const TEAM_EVENTS = [
  "standup.created",
  "standup.updated",
  "activity.created",
] as const;

export type TeamEvent = (typeof TEAM_EVENTS)[number];

export function getTeamChannel({ teamId }: { teamId: string }): string {
  return `team-${teamId}`;
}
