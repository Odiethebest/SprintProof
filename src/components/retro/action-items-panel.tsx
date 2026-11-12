import Link from "next/link";
import { CircleCheck, ListChecks } from "lucide-react";
import { EMPTY_STATE_LINK_CLASSES } from "@/components/ui/empty-state";
import { ActionItemCheckbox } from "./action-item-checkbox";

export interface ActionItemView {
  id: string;
  text: string;
  voteCount: number;
  isDone: boolean;
}

// The retro's state, which decides what "For <next sprint>" says.
export type RetroState = "NOT_OPENED" | "OPEN" | "CLOSED";

// Focus lands here after the lead closes the retro: the button that did it
// goes away, and this panel now lists the new action items.
export const ACTION_ITEMS_TITLE_ID = "retro-action-items-title";

function pluralizeVotes(count: number): string {
  return `${count} vote${count === 1 ? "" : "s"}`;
}

function Votes({ count }: { count: number }) {
  return (
    <span className="shrink-0 font-mono text-xs tabular-nums text-text-muted">
      {pluralizeVotes(count)}
    </span>
  );
}

// "Done" next to the icon, so the state isn't shown by the icon alone.
function DoneLabel() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 text-xs text-met">
      <CircleCheck size={12} aria-hidden="true" />
      Done
    </span>
  );
}

function ItemText({ item }: { item: ActionItemView }) {
  return (
    <span className="flex min-w-0 items-start gap-2">
      <ListChecks
        size={16}
        aria-hidden="true"
        className="shrink-0 text-primary"
      />
      <span className="break-words text-sm">{item.text}</span>
    </span>
  );
}

function fromRetrosLine(sprintNames: string[]): string {
  const names = [...new Set(sprintNames)];
  return `From the ${names.join(" and ")} retro${names.length === 1 ? "" : "s"}`;
}

const NEXT_SPRINT_NOTES: Record<RetroState, string> = {
  NOT_OPENED: "Set when the lead closes this retro.",
  OPEN: "When the lead closes this retro, the top 3 “To improve” items become action items. If it closed now:",
  CLOSED: "The top 3 “To improve” items from this retro.",
};

// AGENTS.md §2 Action items panel: what the previous retro carried into this
// sprint, with done checkboxes, and what this retro gives the next sprint. While
// the retro is open, the second list previews what closing it now would make.
export function ActionItemsPanel({
  sprintName,
  carried,
  carriedFrom,
  checkboxes,
  retroState,
  nextSprintName,
  nextItems,
  addSprintHref,
}: {
  sprintName: string;
  carried: ActionItemView[];
  // The sprints whose retros the carried items came from.
  carriedFrom: string[];
  // Where checking an item off is saved; null when the viewer can't change it.
  checkboxes: { teamId: string; sprintId: string } | null;
  retroState: RetroState;
  // null when the team hasn't added a sprint after this one.
  nextSprintName: string | null;
  // The preview while open, the action items made once closed.
  nextItems: ActionItemView[];
  // Settings, for a lead whose open retro has no next sprint to close into.
  addSprintHref: string | null;
}) {
  const carriedTitle = `Carried into ${sprintName}`;
  const nextTitle =
    nextSprintName === null ? "For the next sprint" : `For ${nextSprintName}`;
  const isMissingNextSprint = retroState === "OPEN" && nextSprintName === null;
  return (
    <section
      aria-labelledby={ACTION_ITEMS_TITLE_ID}
      className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 md:p-6"
    >
      <h2
        id={ACTION_ITEMS_TITLE_ID}
        tabIndex={-1}
        className="rounded-sm text-lg font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
      >
        Action items
      </h2>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-col gap-1">
            <h3 id="retro-carried-title" className="text-sm font-semibold">
              {carriedTitle}
            </h3>
            {carried.length > 0 && (
              <p className="text-xs text-text-muted">
                {fromRetrosLine(carriedFrom)}
              </p>
            )}
          </div>
          {carried.length === 0 ? (
            <p className="text-sm text-text-muted">
              Nothing was carried into {sprintName}. Action items come from the
              previous sprint&apos;s retro.
            </p>
          ) : (
            <ul
              aria-labelledby="retro-carried-title"
              className="flex flex-col gap-2"
            >
              {carried.map((item) => (
                <li
                  key={item.id}
                  className="flex items-start justify-between gap-3"
                >
                  {checkboxes === null ? (
                    <span className="flex min-w-0 items-start gap-2">
                      <ItemText item={item} />
                      {item.isDone && <DoneLabel />}
                    </span>
                  ) : (
                    <ActionItemCheckbox
                      teamId={checkboxes.teamId}
                      sprintId={checkboxes.sprintId}
                      actionItemId={item.id}
                      text={item.text}
                      isDone={item.isDone}
                    />
                  )}
                  <Votes count={item.voteCount} />
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-col gap-1">
            <h3 id="retro-next-title" className="text-sm font-semibold">
              {nextTitle}
            </h3>
            <p className="text-xs text-text-muted">
              {NEXT_SPRINT_NOTES[retroState]}
            </p>
          </div>
          {retroState !== "NOT_OPENED" &&
            (nextItems.length === 0 ? (
              <p className="text-sm text-text-muted">
                {retroState === "OPEN" ? "No “To improve” items yet." : "None."}
              </p>
            ) : (
              <ul
                aria-labelledby="retro-next-title"
                className="flex flex-col gap-2"
              >
                {nextItems.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-start justify-between gap-3"
                  >
                    <ItemText item={item} />
                    {item.isDone && <DoneLabel />}
                    <Votes count={item.voteCount} />
                  </li>
                ))}
              </ul>
            ))}
          {isMissingNextSprint &&
            (addSprintHref === null ? (
              <p className="text-sm text-text-muted">
                The lead adds the next sprint before closing this retro.
              </p>
            ) : (
              <p className="text-sm text-text-muted">
                Closing this retro needs a sprint after {sprintName}.{" "}
                <Link href={addSprintHref} className={EMPTY_STATE_LINK_CLASSES}>
                  Add the next sprint in Settings
                </Link>
              </p>
            ))}
        </div>
      </div>
    </section>
  );
}
