import type { RetroColumn as RetroColumnName } from "@/lib/retro/retro-votes";
import { RetroItemForm } from "./retro-item-form";
import { VoteButton, VoteCount } from "./vote-button";

export interface RetroItemView {
  id: string;
  text: string;
  authorName: string;
  voteCount: number;
  hasVoted: boolean;
}

// What the viewer can do with the column: add items and vote while the retro
// is open, or only read it (closed, or an instructor).
export type RetroColumnMode =
  | { kind: "OPEN"; teamId: string; sprintId: string; votesLeft: number }
  | { kind: "READ_ONLY" };

const COPY: Record<
  RetroColumnName,
  { title: string; placeholder: string; inputId: string }
> = {
  WENT_WELL: {
    title: "Went well",
    placeholder: "Something that helped",
    inputId: "retro-add-went-well",
  },
  TO_IMPROVE: {
    title: "To improve",
    placeholder: "Something to change",
    inputId: "retro-add-to-improve",
  },
};

// The id of the first column's "Add item" field.
export const FIRST_RETRO_FIELD_ID = COPY.WENT_WELL.inputId;

function pluralizeItems(count: number): string {
  return `${count} item${count === 1 ? "" : "s"}`;
}

// AGENTS.md §2 RetroColumn: title, item count, items sorted by votes (ties:
// earliest first) with their author and votes, and "Add item" at the bottom.
export function RetroColumn({
  column,
  items,
  mode,
}: {
  column: RetroColumnName;
  items: RetroItemView[];
  mode: RetroColumnMode;
}) {
  const { title, placeholder, inputId } = COPY[column];
  const titleId = `${inputId}-title`;
  return (
    <section
      aria-labelledby={titleId}
      className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 md:p-6"
    >
      <div className="flex flex-col gap-1">
        <h2 id={titleId} className="text-lg font-semibold">
          {title}
        </h2>
        <p className="text-xs text-text-muted">
          {pluralizeItems(items.length)}
        </p>
      </div>
      {items.length === 0 ? (
        <p className="rounded-md border border-border p-6 text-center text-sm text-text-muted">
          {mode.kind === "OPEN"
            ? "No items yet. Add the first one below."
            : "No items."}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-start justify-between gap-3 rounded-md border border-border p-3"
            >
              <div className="flex min-w-0 flex-col gap-1">
                <p className="break-words text-sm">{item.text}</p>
                <p className="text-xs text-text-muted">{item.authorName}</p>
              </div>
              {mode.kind === "OPEN" ? (
                <VoteButton
                  teamId={mode.teamId}
                  sprintId={mode.sprintId}
                  itemId={item.id}
                  itemText={item.text}
                  voteCount={item.voteCount}
                  hasVoted={item.hasVoted}
                  votesLeft={mode.votesLeft}
                />
              ) : (
                <VoteCount count={item.voteCount} />
              )}
            </li>
          ))}
        </ul>
      )}
      {mode.kind === "OPEN" && (
        <RetroItemForm
          teamId={mode.teamId}
          sprintId={mode.sprintId}
          column={column}
          columnTitle={title}
          placeholder={placeholder}
          inputId={inputId}
        />
      )}
    </section>
  );
}
