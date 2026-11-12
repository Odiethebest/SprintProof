"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  NETWORK_ERROR_MESSAGE,
  readApiError,
} from "@/components/teams/api-error";
import { useAnnounce } from "@/components/ui/page-announcer";

// The done checkbox of an action item carried into this sprint (#13).
export function ActionItemCheckbox({
  teamId,
  sprintId,
  actionItemId,
  text,
  isDone,
}: {
  teamId: string;
  sprintId: string;
  actionItemId: string;
  text: string;
  isDone: boolean;
}) {
  const router = useRouter();
  const announce = useAnnounce();
  const [, startRefresh] = useTransition();
  // Shows the click at once; a new server value (a teammate's change) wins.
  const [isChecked, setIsChecked] = useState(isDone);
  const [serverIsDone, setServerIsDone] = useState(isDone);
  const [isSending, setIsSending] = useState(false);
  const id = useId();
  if (isDone !== serverIsDone) {
    setServerIsDone(isDone);
    setIsChecked(isDone);
  }

  async function setDone(nextIsDone: boolean) {
    // Not disabled while saving, which would take focus off the checkbox.
    if (isSending) {
      return;
    }
    setIsChecked(nextIsDone);
    setIsSending(true);
    try {
      const response = await fetch(
        `/api/v1/teams/${teamId}/sprints/${sprintId}/retro/action-items/${actionItemId}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ isDone: nextIsDone }),
        }
      );
      if (response.ok) {
        announce(nextIsDone ? "Marked done." : "Marked not done.");
        startRefresh(() => router.refresh());
      } else {
        setIsChecked(!nextIsDone);
        announce((await readApiError(response)).message);
      }
    } catch {
      setIsChecked(!nextIsDone);
      announce(NETWORK_ERROR_MESSAGE);
    }
    setIsSending(false);
  }

  return (
    <span className="flex min-w-0 items-start gap-2">
      <input
        id={id}
        type="checkbox"
        checked={isChecked}
        onChange={(event) => void setDone(event.target.checked)}
        className="size-4 shrink-0 accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
      />
      <label htmlFor={id} className="break-words text-sm">
        {text}
      </label>
    </span>
  );
}
