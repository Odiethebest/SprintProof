export interface GetSummaryFileNameOptions {
  sprint: { id: string; name: string; startDate: string };
  sprints: ReadonlyArray<{ id: string; startDate: string }>;
}

// "Sprint 2", or a name that starts with it, such as "Sprint 2 – catch-up".
const SPRINT_NUMBER = /^sprint\s*(\d+)/i;

// The sprint's place among the team's sprints by start date, the first one 1.
// Sprints never overlap, so no two start on the same day.
function getSprintPlace({ sprint, sprints }: GetSummaryFileNameOptions) {
  const earlier = sprints.filter(
    (other) => other.id !== sprint.id && other.startDate < sprint.startDate
  );
  return earlier.length + 1;
}

// sprint-N-summary.md (AGENTS.md §2 ExportButton). N is the number in a name
// that starts with "Sprint N"; any other name, such as "Webhooks week", uses
// the sprint's place by start date instead.
export function getSummaryFileName(options: GetSummaryFileNameOptions): string {
  const match = SPRINT_NUMBER.exec(options.sprint.name.trim());
  const number =
    match === null
      ? String(getSprintPlace(options))
      : match[1].replace(/^0+(?=\d)/, "");
  return `sprint-${number}-summary.md`;
}
