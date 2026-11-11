import { MessageSquare } from "lucide-react";
import {
  StandupDayList,
  type StandupDayView,
} from "@/components/standups/standup-history";
import { EmptyState } from "@/components/ui/empty-state";

// AGENTS.md §2 Review "Standups": the selected sprint's standups by day,
// newest first, read-only.
export function ReviewStandups({
  sprintName,
  days,
}: {
  sprintName: string;
  days: StandupDayView[];
}) {
  return (
    <section
      aria-labelledby="review-standups-title"
      className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 md:p-6"
    >
      <div className="flex flex-col gap-1">
        <h2 id="review-standups-title" className="text-lg font-semibold">
          Standups
        </h2>
        <p className="text-xs text-text-muted">{sprintName}, newest first</p>
      </div>
      {days.length === 0 ? (
        <EmptyState Icon={MessageSquare}>
          <p className="text-sm text-text-muted">
            No standups in {sprintName} yet.
          </p>
        </EmptyState>
      ) : (
        <StandupDayList days={days} />
      )}
    </section>
  );
}
