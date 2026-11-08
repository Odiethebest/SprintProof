"use client";

import { useId } from "react";
import { usePathname, useRouter } from "next/navigation";

export interface SprintOptionView {
  id: string;
  // "Sprint 1 · Oct 29 – Nov 4 · Current"
  label: string;
}

// The top bar's sprint selector (AGENTS.md §2 Screens). The choice lives in the
// URL (`?sprint=`), so the server renders the page for that sprint.
export function SprintSelector({
  options,
  selectedId,
}: {
  options: SprintOptionView[];
  selectedId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const id = useId();
  return (
    <div className="min-w-0">
      {/* The options name the sprint, so the label is for screen readers only. */}
      <label htmlFor={id} className="sr-only">
        Sprint
      </label>
      <select
        // A new key resets the uncontrolled value when the server sends another selection.
        key={selectedId}
        id={id}
        defaultValue={selectedId}
        onChange={(event) =>
          router.push(
            `${pathname}?sprint=${encodeURIComponent(event.target.value)}`
          )
        }
        className="h-9 w-full max-w-full rounded-md border border-border bg-surface px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
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
