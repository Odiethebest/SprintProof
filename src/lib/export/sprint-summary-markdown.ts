import { tz } from "@date-fns/tz";
import { format } from "date-fns";
import type { TeamRole } from "@/lib/auth/team-access";
import type { RequirementStatus } from "@/lib/checks";
import { MAX_VOTES_PER_RETRO, type RetroColumn } from "@/lib/retro/retro-votes";
import type { MemberSummary, SprintSummary } from "@/lib/stats/sprint-summary";

// Peer feedback may only go into an instructor's export (AGENTS.md §1, PRD R7).
export type ExportAudience = "TEAM" | "INSTRUCTOR";

export interface ExportStandup {
  userId: string;
  // YYYY-MM-DD: the team-timezone day it was filed under.
  date: string;
  yesterday: string;
  today: string;
  blockers: string | null;
}

// The sprint's retro (#13), or null before the lead opens it.
export interface ExportRetro {
  // null while the retro is open.
  closedAt: Date | null;
  // In vote order, as tallyRetroItems() sorts them.
  items: Array<{ column: RetroColumn; text: string; voteCount: number }>;
  // The sprint the action items are for; null when the team hasn't added it.
  nextSprintName: string | null;
  // Made when the retro closes, in order; empty while it's open.
  actionItems: Array<{ text: string; isDone: boolean }>;
}

export interface BuildSprintSummaryMarkdownOptions {
  team: { name: string; repoFullName: string; timezone: string };
  summary: SprintSummary;
  standups: ExportStandup[];
  audience: ExportAudience;
  retro: ExportRetro | null;
}

const STATUS_LABELS: Record<RequirementStatus, string> = {
  MET: "Met",
  ON_TRACK: "On track",
  AT_RISK: "At risk",
  MISSED: "Missed",
};

// Peer feedback (#14) isn't built yet; an instructor's export says so.
const PEER_FEEDBACK_NOTES: Record<ExportAudience, string> = {
  TEAM: "Team exports leave out peer feedback.",
  INSTRUCTOR: "Peer feedback isn't recorded in SprintProof yet.",
};

const RETRO_COLUMN_TITLES: Record<RetroColumn, string> = {
  WENT_WELL: "Went well",
  TO_IMPROVE: "To improve",
};

export function getExportAudience({
  role,
}: {
  role: TeamRole;
}): ExportAudience {
  return role === "INSTRUCTOR" ? "INSTRUCTOR" : "TEAM";
}

// Collapses line breaks, so a name or an answer can't end its table row or
// start a new Markdown block.
function toInline(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

// Backslashes first: a typed `\|` would otherwise come out as `\\|`, an
// escaped backslash and then a real column break (CodeQL js/incomplete-sanitization).
function toTableCell(text: string): string {
  return toInline(text).replace(/\\/g, "\\\\").replace(/\|/g, "\\|");
}

function pluralize(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function toDisplayName(member: MemberSummary): string {
  return toInline(member.name ?? member.githubLogin ?? "GitHub user");
}

// "2 / 5 · At risk" (DESIGN.md §3); no status before the sprint starts.
function formatProgress(progress: MemberSummary["standups"]): string {
  const counts = `${progress.count} / ${progress.required}`;
  return progress.status === null
    ? counts
    : `${counts} · ${STATUS_LABELS[progress.status]}`;
}

function describeSprintState(sprint: SprintSummary["sprint"]): string {
  if (sprint.state === "ENDED") {
    return "Ended";
  }
  // Days left is null only before the sprint starts (#92).
  return sprint.daysLeft === null
    ? "Not started"
    : `${pluralize(sprint.daysLeft, "day")} left`;
}

function buildHeader({
  team,
  summary,
}: Pick<BuildSprintSummaryMarkdownOptions, "team" | "summary">): string[] {
  const { sprint } = summary;
  // Exports use ISO dates (DESIGN.md §9), in the team's timezone.
  const countsAsOf = format(summary.countsAsOf, "yyyy-MM-dd", {
    in: tz(team.timezone),
  });
  return [
    `# ${toInline(sprint.name)} summary`,
    "",
    `**Team:** ${toInline(team.name)} (${team.repoFullName}) · **Timezone:** ${team.timezone}`,
    `**Dates:** ${sprint.startDate} – ${sprint.endDate} · ${describeSprintState(sprint)} · **Counts as of:** ${countsAsOf}`,
    `**Requirements:** ${pluralize(sprint.standupsPerPerson, "standup")} and ${pluralize(sprint.reviewsPerPerson, "PR review")} per person`,
  ];
}

function buildRequirementsTable(members: MemberSummary[]): string[] {
  const rows = members.map((member) => {
    const cells = [
      toTableCell(toDisplayName(member)),
      member.githubLogin === null ? "—" : `@${member.githubLogin}`,
      formatProgress(member.standups),
      formatProgress(member.reviews),
      String(member.commits),
      String(member.pullRequests),
    ];
    return `| ${cells.join(" | ")} |`;
  });
  return [
    "## Requirements",
    "| Member | GitHub | Standups | PR reviews | Commits | PRs |",
    "| --- | --- | --- | --- | --- | --- |",
    ...rows,
  ];
}

// One entry as the files in docs/sprints/ write it.
function buildStandupEntry(standup: ExportStandup): string[] {
  return [
    `#### ${standup.date}`,
    `**Yesterday:** ${toInline(standup.yesterday)}`,
    `**Today:** ${toInline(standup.today)}`,
    `**Blockers:** ${standup.blockers === null ? "None." : toInline(standup.blockers)}`,
    "",
  ];
}

// A member's standups, newest first, like a file in docs/sprints/*/standups/.
function buildMemberStandups({
  member,
  standups,
  sprintName,
}: {
  member: MemberSummary;
  standups: ExportStandup[];
  sprintName: string;
}): string[] {
  const own = standups
    .filter((standup) => standup.userId === member.userId)
    .sort((a, b) => b.date.localeCompare(a.date));
  return [
    `### ${toDisplayName(member)}`,
    "",
    ...(own.length === 0
      ? [`No standups in ${sprintName}.`, ""]
      : own.flatMap(buildStandupEntry)),
  ];
}

// One retro column as a table, like "To improve" in docs/sprints/*/retro.md.
function buildRetroColumn({
  retro,
  column,
}: {
  retro: ExportRetro;
  column: RetroColumn;
}): string[] {
  const items = retro.items.filter((item) => item.column === column);
  const rows =
    items.length === 0
      ? ["No items."]
      : [
          "| Item | Votes |",
          "| --- | --- |",
          ...items.map(
            (item) => `| ${toTableCell(item.text)} | ${item.voteCount} |`
          ),
        ];
  return [`### ${RETRO_COLUMN_TITLES[column]}`, ...rows, ""];
}

function buildActionItems({ retro }: { retro: ExportRetro }): string[] {
  const heading =
    retro.nextSprintName === null
      ? "### Action items for the next sprint"
      : `### Action items for ${toInline(retro.nextSprintName)}`;
  if (retro.closedAt === null) {
    return [heading, "Set when the lead closes the retro.", ""];
  }
  const items =
    retro.actionItems.length === 0
      ? ["None."]
      : retro.actionItems.map(
          (item) => `- [${item.isDone ? "x" : " "}] ${toInline(item.text)}`
        );
  return [heading, ...items, ""];
}

// The retro as docs/sprints/*/retro.md records it: both columns with their
// votes, then the action items for the next sprint (#13).
function buildRetro({
  retro,
  sprintName,
  timeZone,
}: {
  retro: ExportRetro | null;
  sprintName: string;
  timeZone: string;
}): string[] {
  if (retro === null) {
    return [
      "## Retro",
      `The lead hasn't opened the ${sprintName} retro yet.`,
      "",
    ];
  }
  // Exports use ISO dates (DESIGN.md §9), in the team's timezone.
  const status =
    retro.closedAt === null
      ? "Open"
      : `Closed ${format(retro.closedAt, "yyyy-MM-dd", { in: tz(timeZone) })}`;
  return [
    "## Retro",
    `**Status:** ${status} · ${MAX_VOTES_PER_RETRO} votes each, 1 per item`,
    "",
    ...buildRetroColumn({ retro, column: "WENT_WELL" }),
    ...buildRetroColumn({ retro, column: "TO_IMPROVE" }),
    ...buildActionItems({ retro }),
  ];
}

// A sprint's summary as Markdown, in the style of the files in docs/sprints/:
// the sprint, each member's counts and status, standups by person, and the
// retro. Only the members the summary counts are listed, so instructors aren't.
export function buildSprintSummaryMarkdown({
  team,
  summary,
  standups,
  audience,
  retro,
}: BuildSprintSummaryMarkdownOptions): string {
  const sprintName = toInline(summary.sprint.name);
  return [
    ...buildHeader({ team, summary }),
    "",
    ...buildRequirementsTable(summary.members),
    "",
    "## Standups",
    "",
    ...summary.members.flatMap((member) =>
      buildMemberStandups({ member, standups, sprintName })
    ),
    ...buildRetro({ retro, sprintName, timeZone: team.timezone }),
    "## Peer feedback",
    PEER_FEEDBACK_NOTES[audience],
    "",
  ].join("\n");
}
