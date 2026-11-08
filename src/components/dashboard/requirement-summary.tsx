import type { RequirementSummary as Summary } from "@/lib/checks";
import { StatusLabel } from "./status-label";

// AGENTS.md §2 RequirementSummary: one line for the signed-in member.
export function RequirementSummary({ summary }: { summary: Summary }) {
  return (
    <section
      aria-label="Your requirements"
      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border bg-surface px-4 py-3 text-sm"
    >
      <StatusLabel status={summary.status} />
      <p>{summary.sentence}</p>
    </section>
  );
}
