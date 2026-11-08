import type {
  RequirementProgress,
  RequirementStatus,
} from "./requirement-status";

export interface SummarizeRequirementsOptions {
  sprintName: string;
  standups: RequirementProgress;
  reviews: RequirementProgress;
  isSprintEnded: boolean;
}

export interface RequirementSummary {
  status: RequirementStatus;
  sentence: string;
}

// Least favorable first: the summary shows the worst status among open requirements.
const OPEN_STATUS_ORDER: RequirementStatus[] = [
  "MISSED",
  "AT_RISK",
  "ON_TRACK",
];

function pluralize(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

// The RequirementSummary line for the signed-in member (AGENTS.md §2). Counts
// and what's left only, in neutral words (DESIGN.md §9).
export function summarizeRequirements({
  sprintName,
  standups,
  reviews,
  isSprintEnded,
}: SummarizeRequirementsOptions): RequirementSummary {
  const requirements = [
    { progress: standups, noun: "standup" },
    { progress: reviews, noun: "PR review" },
  ];
  const open = requirements.filter(({ progress }) => progress.status !== "MET");
  const metCount = requirements.length - open.length;
  const status =
    OPEN_STATUS_ORDER.find((candidate) =>
      open.some(({ progress }) => progress.status === candidate)
    ) ?? "MET";

  if (isSprintEnded) {
    return {
      status,
      sentence: `${sprintName} has ended. You met ${metCount} of ${requirements.length} requirements.`,
    };
  }
  const met = `You've met ${metCount} of ${requirements.length} requirements.`;
  if (open.length === 0) {
    return { status, sentence: met };
  }
  const toGo = open
    .map(({ progress, noun }) => pluralize(progress.remaining, noun))
    .join(" and ");
  return { status, sentence: `${met} ${toGo} to go.` };
}
