"use client";

import { useId, useRef, useState, useTransition, type FormEvent } from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import { CircleAlert, Plus } from "lucide-react";
import { createRetroItemSchema } from "@/lib/retro/retro-input";
import type { RetroColumn } from "@/lib/retro/retro-votes";
import {
  NETWORK_ERROR_MESSAGE,
  readApiError,
} from "@/components/teams/api-error";
import { BUTTON_CLASSES } from "@/components/ui/button-styles";
import { useAnnounce } from "@/components/ui/page-announcer";

// DESIGN.md §7 Forms: the border turns `missed` on error.
const INPUT_CLASSES = {
  valid:
    "h-9 w-full min-w-0 rounded-md border border-form-control-border bg-surface px-3 text-sm placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
  invalid:
    "h-9 w-full min-w-0 rounded-md border border-missed bg-surface px-3 text-sm placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
} as const;

// The "Add item" field at the bottom of a RetroColumn (AGENTS.md §2). The
// first column's field takes focus when the lead opens the retro.
export function RetroItemForm({
  teamId,
  sprintId,
  column,
  columnTitle,
  placeholder,
  inputId,
}: {
  teamId: string;
  sprintId: string;
  column: RetroColumn;
  columnTitle: string;
  placeholder: string;
  inputId: string;
}) {
  const router = useRouter();
  const announce = useAnnounce();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [, startRefresh] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const errorId = useId();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSending) {
      return;
    }
    // The same schema as the API, so the field shows its errors before sending.
    const parsed = createRetroItemSchema.safeParse({ column, text });
    if (!parsed.success) {
      // Render the error first, so a screen reader hears it with the field.
      flushSync(() =>
        setError(parsed.error.issues[0]?.message ?? "Check the item.")
      );
      inputRef.current?.focus();
      return;
    }
    setError(null);
    setIsSending(true);
    try {
      const response = await fetch(
        `/api/v1/teams/${teamId}/sprints/${sprintId}/retro/items`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(parsed.data),
        }
      );
      if (response.ok) {
        setText("");
        announce(`Added to ${columnTitle}.`);
        startRefresh(() => router.refresh());
      } else {
        setError((await readApiError(response)).message);
      }
    } catch {
      setError(NETWORK_ERROR_MESSAGE);
    }
    setIsSending(false);
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-1">
      <label htmlFor={inputId} className="text-sm font-medium">
        Add item<span className="sr-only"> to {columnTitle}</span>
      </label>
      <div className="flex gap-2">
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          value={text}
          placeholder={placeholder}
          onChange={(event) => setText(event.target.value)}
          aria-invalid={error === null ? undefined : true}
          aria-describedby={error === null ? undefined : errorId}
          className={
            error === null ? INPUT_CLASSES.valid : INPUT_CLASSES.invalid
          }
        />
        <button
          type="submit"
          disabled={isSending}
          className={BUTTON_CLASSES.secondary}
        >
          <Plus size={16} aria-hidden="true" />
          Add<span className="sr-only"> to {columnTitle}</span>
        </button>
      </div>
      {error !== null && (
        <p id={errorId} className="flex items-center gap-1 text-xs text-missed">
          <CircleAlert size={12} aria-hidden="true" />
          {error}
        </p>
      )}
    </form>
  );
}
