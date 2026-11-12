"use client";

import { startTransition, useId, useOptimistic } from "react";
import { useRouter } from "next/navigation";

export interface SprintOptionView {
  id: string;
  // "Sprint 1 · Oct 29 – Nov 4 · Current"
  label: string;
}

// An option with the page that shows its sprint: `?sprint=` on most pages, the
// sprint's own retro on a retro (#13).
export interface SprintLinkView extends SprintOptionView {
  href: string;
}

// Cache Components keeps each URL's page in its own hidden <Activity>
// (node_modules/next/dist/docs/01-app/02-guides/preserving-ui-state.md), so
// picking a sprint renders a new page with a new select and hides the old one,
// focus included. The sprint picked here waits until a select showing it
// mounts, and that select takes focus (WCAG 2.4.3, #77).
let pendingFocusSprintId: string | null = null;

// The top bar's sprint selector (AGENTS.md §2 Screens). The choice lives in the
// URL, so the server renders the page for that sprint.
export function SprintSelector({
  options,
  selectedId,
}: {
  options: SprintLinkView[];
  selectedId: string;
}) {
  const router = useRouter();
  const id = useId();
  // Controlled, so a page that Back or Forward shows again has the server's
  // selection, not the choice the user made before leaving it. The optimistic
  // value keeps the new choice on screen until that navigation lands.
  const [value, setOptimisticValue] = useOptimistic(selectedId);
  return (
    <div className="min-w-0">
      {/* The options name the sprint, so the label is for screen readers only. */}
      <label htmlFor={id} className="sr-only">
        Sprint
      </label>
      <select
        // Runs again on each render, so a select that stays mounted (no new
        // page) also clears the pending sprint once it shows it.
        ref={(element) => {
          if (element !== null && pendingFocusSprintId === selectedId) {
            pendingFocusSprintId = null;
            element.focus();
          }
        }}
        id={id}
        value={value}
        onChange={(event) => {
          const sprintId = event.target.value;
          const option = options.find(({ id }) => id === sprintId);
          if (option === undefined) {
            return;
          }
          pendingFocusSprintId = sprintId;
          startTransition(() => {
            setOptimisticValue(sprintId);
            router.push(option.href);
          });
        }}
        className="h-9 w-full max-w-full rounded-md border border-form-control-border bg-surface px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
