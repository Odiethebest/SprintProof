import { tz } from "@date-fns/tz";
import { format } from "date-fns";
import type { TeamRole } from "@/lib/auth/team-access";
import type { RequirementStatus } from "@/lib/checks";
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

export interface BuildSprintSummaryMarkdownOptions {
  team: { name: string; repoFullName: string; timezone: string };
  summary: SprintSummary;
  standups: ExportStandup[];
  audience: ExportAudience;
}

const STATUS_LABELS: Record<RequirementStatus, string> = {
  MET: "Met",
  ON_TRACK: "On track",
  AT_RISK: "At risk",
  MISSED: "Missed",
};

// Retros (#13) and peer feedback (#14) aren't built yet; the export says so.
const NOT_RECORDED =
  "Retro items, action items and peer feedback aren't recorded in SprintProof yet.";

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

// A sprint's summary as Markdown, in the style of the files in docs/sprints/:
// the sprint, each member's counts and status, and standups by person. Only
// the members the summary counts are listed, so instructors aren't.
export function buildSprintSummaryMarkdown({
  team,
  summary,
  standups,
  audience,
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
    "## Retro and peer feedback",
    audience === "TEAM"
      ? `${NOT_RECORDED} Team exports leave out peer feedback.`
      : NOT_RECORDED,
    "",
  ].join("\n");
}
