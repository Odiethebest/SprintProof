"use client";

import { useId, useRef, useState, useTransition, type FormEvent } from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import { CircleAlert } from "lucide-react";
import {
  MAX_PEER_FEEDBACK_LENGTH,
  savePeerFeedbackSchema,
} from "@/lib/peer-feedback/peer-feedback-input";
import { countStandupCharacters } from "@/lib/standups/character-count";
import {
  NETWORK_ERROR_MESSAGE,
  readApiError,
} from "@/components/teams/api-error";
import { BUTTON_CLASSES } from "@/components/ui/button-styles";
import { useAnnounce } from "@/components/ui/page-announcer";
import { SavedOnLabel } from "./saved-on-label";

// DESIGN.md §7 Forms: the border turns `missed` on error.
const TEXTAREA_CLASSES = {
  valid:
    "w-full resize-y rounded-md border border-form-control-border bg-surface px-3 py-2 text-sm placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
  invalid:
    "w-full resize-y rounded-md border border-missed bg-surface px-3 py-2 text-sm placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
} as const;

// One teammate in the PeerFeedbackForm, with what the viewer saved about
// them, if anything. Only ever the viewer's own text (rule R7).
export interface TeammateFeedbackView {
  userId: string;
  name: string;
  savedText: string | null;
  // "Nov 3" in the team's timezone; null before the first save.
  savedOnLabel: string | null;
}

// "Feedback for Yunhong Huang": a textarea with a counter, "Save feedback"
// and the saved date (AGENTS.md §2 PeerFeedbackForm). Saving keeps the text
// in the field; a failed save leaves it there with the error under it.
export function TeammateFeedbackField({
  teamId,
  sprintId,
  teammate,
}: {
  teamId: string;
  sprintId: string;
  teammate: TeammateFeedbackView;
}) {
  const router = useRouter();
  const announce = useAnnounce();
  const [text, setText] = useState(teammate.savedText ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isRefreshing, startRefresh] = useTransition();
  const fieldRef = useRef<HTMLTextAreaElement>(null);
  const id = useId();
  const errorId = `${id}-error`;
  const counterId = `${id}-counter`;
  const characterCount = countStandupCharacters({ value: text });
  const isOverLimit = characterCount > MAX_PEER_FEEDBACK_LENGTH;

  // Render the error first, so a screen reader hears it with the field.
  function showError(message: string) {
    flushSync(() => setError(message));
    fieldRef.current?.focus();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSending) {
      return;
    }
    // The same schema as the API, so the field shows its errors before sending.
    const parsed = savePeerFeedbackSchema.safeParse({ text });
    if (!parsed.success) {
      showError(parsed.error.issues[0]?.message ?? "Check the feedback.");
      return;
    }
    setError(null);
    setIsSending(true);
    try {
      const response = await fetch(
        `/api/v1/teams/${teamId}/sprints/${sprintId}/peer-feedback/${encodeURIComponent(teammate.userId)}`,
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(parsed.data),
        }
      );
      if (response.ok) {
        announce(`Feedback for ${teammate.name} saved.`);
        startRefresh(() => router.refresh());
      } else {
        showError((await readApiError(response)).message);
      }
    } catch {
      showError(NETWORK_ERROR_MESSAGE);
    }
    setIsSending(false);
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-2">
      <div className="flex flex-col gap-1">
        <label htmlFor={id} className="text-sm font-medium">
          Feedback for {teammate.name}
        </label>
        <textarea
          ref={fieldRef}
          id={id}
          name="text"
          rows={4}
          value={text}
          placeholder="What went well working together, and what you'd like to change"
          onChange={(event) => setText(event.target.value)}
          aria-invalid={error === null ? undefined : true}
          aria-describedby={
            error === null ? counterId : `${errorId} ${counterId}`
          }
          className={
            error === null ? TEXTAREA_CLASSES.valid : TEXTAREA_CLASSES.invalid
          }
        />
        <div className="flex items-start justify-between gap-2">
          {error === null ? (
            <span />
          ) : (
            <p
              id={errorId}
              className="flex items-center gap-1 text-xs text-missed"
            >
              <CircleAlert size={12} aria-hidden="true" />
              {error}
            </p>
          )}
          <p
            id={counterId}
            className={
              isOverLimit
                ? "shrink-0 font-mono text-xs tabular-nums text-missed"
                : "shrink-0 font-mono text-xs tabular-nums text-text-muted"
            }
          >
            {characterCount} / {MAX_PEER_FEEDBACK_LENGTH}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={isSending || isRefreshing}
          className={BUTTON_CLASSES.secondary}
        >
          Save feedback<span className="sr-only"> for {teammate.name}</span>
        </button>
        <p className="text-xs text-text-muted">
          <SavedOnLabel label={teammate.savedOnLabel} />
        </p>
      </div>
    </form>
  );
}
