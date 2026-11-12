import { CircleCheck, ClipboardList, Lock } from "lucide-react";
import type { ExportRetro } from "@/lib/export/sprint-summary-markdown";
import type { RetroColumn } from "@/lib/retro/retro-votes";
import { EmptyState } from "@/components/ui/empty-state";
import { Pill } from "@/components/ui/pill";

const COLUMN_TITLES: Record<RetroColumn, string> = {
  WENT_WELL: "Went well",
  TO_IMPROVE: "To improve",
};

function pluralizeVotes(count: number): string {
  return `${count} vote${count === 1 ? "" : "s"}`;
}

function ColumnList({
  retro,
  column,
}: {
  retro: ExportRetro;
  column: RetroColumn;
}) {
  const items = retro.items.filter((item) => item.column === column);
  const titleId = `review-retro-${column.toLowerCase()}`;
  return (
    <div className="flex flex-col gap-2">
      <h3 id={titleId} className="text-sm font-semibold">
        {COLUMN_TITLES[column]}
      </h3>
      {items.length === 0 ? (
        <p className="text-sm text-text-muted">No items.</p>
      ) : (
        <ul aria-labelledby={titleId} className="flex flex-col gap-2">
          {items.map((item, index) => (
            <li
              key={`${index}-${item.text}`}
              className="flex items-start justify-between gap-3 text-sm"
            >
              <span className="min-w-0 break-words">{item.text}</span>
              <span className="shrink-0 font-mono text-xs tabular-nums text-text-muted">
                {pluralizeVotes(item.voteCount)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// AGENTS.md §2 Review "Retro": both columns with their votes, and the action
// items for the next sprint once the lead closes the retro. Read-only.
export function ReviewRetroCard({
  sprintName,
  retro,
}: {
  sprintName: string;
  retro: ExportRetro | null;
}) {
  const nextSprintName = retro === null ? null : retro.nextSprintName;
  const nextTitle =
    nextSprintName === null
      ? "Action items for the next sprint"
      : `Action items for ${nextSprintName}`;
  return (
    <section
      aria-labelledby="review-retro-title"
      className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 md:p-6"
    >
      <div className="flex items-start justify-between gap-2">
        <h2 id="review-retro-title" className="text-lg font-semibold">
          Retro
        </h2>
        {retro !== null && (
          <Pill>
            {retro.closedAt !== null && <Lock size={12} aria-hidden="true" />}
            {retro.closedAt === null ? "Open" : "Closed"}
          </Pill>
        )}
      </div>
      {retro === null ? (
        <EmptyState Icon={ClipboardList}>
          <p className="text-sm text-text-muted">
            The lead hasn&apos;t opened the {sprintName} retro yet.
          </p>
        </EmptyState>
      ) : (
        <>
          <ColumnList retro={retro} column="WENT_WELL" />
          <ColumnList retro={retro} column="TO_IMPROVE" />
          <div className="flex flex-col gap-2">
            <h3
              id="review-retro-action-items"
              className="text-sm font-semibold"
            >
              {nextTitle}
            </h3>
            {retro.closedAt === null ? (
              <p className="text-sm text-text-muted">
                Set when the lead closes the retro.
              </p>
            ) : retro.actionItems.length === 0 ? (
              <p className="text-sm text-text-muted">None.</p>
            ) : (
              <ul
                aria-labelledby="review-retro-action-items"
                className="flex flex-col gap-2"
              >
                {retro.actionItems.map((item, index) => (
                  <li
                    key={`${index}-${item.text}`}
                    className="flex items-start justify-between gap-3 text-sm"
                  >
                    <span className="min-w-0 break-words">{item.text}</span>
                    {item.isDone && (
                      <span className="inline-flex shrink-0 items-center gap-1 text-xs text-met">
                        <CircleCheck size={12} aria-hidden="true" />
                        Done
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  );
}
