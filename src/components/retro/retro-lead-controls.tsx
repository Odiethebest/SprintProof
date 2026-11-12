"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import {
  NETWORK_ERROR_MESSAGE,
  readApiError,
} from "@/components/teams/api-error";
import { BUTTON_CLASSES } from "@/components/ui/button-styles";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useAnnounce } from "@/components/ui/page-announcer";
import type { RetroState } from "./action-items-panel";
import { ACTION_ITEMS_TITLE_ID } from "./action-items-panel";
import { FIRST_RETRO_FIELD_ID } from "./retro-column";

// The lead's one action on the retro page: "Open retro" before it's open,
// "Close retro" while it's open (AGENTS.md §2 Close retro). It stays mounted
// across both, so it can move focus once the page shows the new state.
export function RetroLeadControls({
  teamId,
  sprintId,
  sprintName,
  retroState,
  nextSprintName,
  closingItems,
}: {
  teamId: string;
  sprintId: string;
  sprintName: string;
  retroState: RetroState;
  // null when there's no sprint to close into, so closing isn't offered.
  nextSprintName: string | null;
  // The "To improve" items closing would make into action items, in order.
  closingItems: Array<{ id: string; text: string }>;
}) {
  const router = useRouter();
  const announce = useAnnounce();
  const [isRefreshing, startRefresh] = useTransition();
  const [isSending, setIsSending] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [closeError, setCloseError] = useState<string | null>(null);
  const afterCloseRef = useRef<HTMLElement | null>(null);
  // After opening, the first "Add item" field takes focus once it renders.
  const isFocusPendingRef = useRef(false);
  const retroPath = `/api/v1/teams/${teamId}/sprints/${sprintId}/retro`;

  useEffect(() => {
    if (isRefreshing || !isFocusPendingRef.current) {
      return;
    }
    isFocusPendingRef.current = false;
    document.getElementById(FIRST_RETRO_FIELD_ID)?.focus();
  }, [isRefreshing, retroState]);

  async function openRetro() {
    if (isSending) {
      return;
    }
    setIsSending(true);
    try {
      const response = await fetch(retroPath, { method: "POST" });
      if (response.ok) {
        announce(`${sprintName} retro opened.`);
        isFocusPendingRef.current = true;
        startRefresh(() => router.refresh());
      } else {
        announce((await readApiError(response)).message);
        startRefresh(() => router.refresh());
      }
    } catch {
      announce(NETWORK_ERROR_MESSAGE);
    }
    setIsSending(false);
  }

  async function closeRetro() {
    if (isSending) {
      return;
    }
    setIsSending(true);
    setCloseError(null);
    try {
      const response = await fetch(retroPath, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "CLOSED" }),
      });
      if (response.ok) {
        // The Close retro button goes away; the action items panel lists
        // what closing made.
        afterCloseRef.current = document.getElementById(ACTION_ITEMS_TITLE_ID);
        setIsDialogOpen(false);
        announce(`${sprintName} retro closed.`);
        startRefresh(() => router.refresh());
      } else {
        setCloseError((await readApiError(response)).message);
      }
    } catch {
      setCloseError(NETWORK_ERROR_MESSAGE);
    }
    setIsSending(false);
  }

  if (retroState === "NOT_OPENED") {
    return (
      <button
        type="button"
        onClick={openRetro}
        disabled={isSending || isRefreshing}
        className={BUTTON_CLASSES.primary}
      >
        Open retro
      </button>
    );
  }
  if (retroState === "CLOSED" || nextSprintName === null) {
    return null;
  }
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setCloseError(null);
          setIsDialogOpen(true);
        }}
        className={BUTTON_CLASSES.primary}
      >
        <Lock size={16} aria-hidden="true" />
        Close retro
      </button>
      <ConfirmDialog
        isOpen={isDialogOpen}
        title={`Close the ${sprintName} retro?`}
        confirmLabel="Close retro"
        confirmVariant="primary"
        isBusy={isSending}
        error={closeError}
        onConfirm={() => void closeRetro()}
        onCancel={() => setIsDialogOpen(false)}
        focusAfterConfirmRef={afterCloseRef}
      >
        {closingItems.length === 0 ? (
          <p>
            There are no &ldquo;To improve&rdquo; items, so {nextSprintName}{" "}
            gets no action items.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            <p>
              These &ldquo;To improve&rdquo; items become action items for{" "}
              {nextSprintName}:
            </p>
            <ol className="flex list-decimal flex-col gap-1 pl-6">
              {closingItems.map((item) => (
                <li key={item.id} className="break-words">
                  {item.text}
                </li>
              ))}
            </ol>
          </div>
        )}
        <p className="mt-2 text-text-muted">
          After closing, items and votes can&apos;t change.
        </p>
      </ConfirmDialog>
    </>
  );
}
