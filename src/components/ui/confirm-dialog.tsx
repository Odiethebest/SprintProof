"use client";

import {
  useEffect,
  useId,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";
import { CircleAlert } from "lucide-react";
import { BUTTON_CLASSES } from "@/components/ui/button-styles";

// DESIGN.md §7 Dialog: native <dialog>, Cancel first, then the action.
// Cancelling returns focus to whatever had it when the dialog opened (AGENTS.md
// §2 Confirmations). After the action the trigger may be about to disappear
// (a revoked row), so focus goes to focusAfterConfirmRef instead.
export function ConfirmDialog({
  isOpen,
  title,
  children,
  confirmLabel,
  confirmVariant,
  isBusy,
  error,
  onConfirm,
  onCancel,
  focusAfterConfirmRef,
}: {
  isOpen: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  // "destructive" only for deleting or revoking (DESIGN.md §7 Button).
  confirmVariant: "primary" | "destructive";
  isBusy: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
  focusAfterConfirmRef: RefObject<HTMLElement | null>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const isCancellingRef = useRef(false);
  const titleId = useId();
  const bodyId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) {
      return;
    }
    if (isOpen && !dialog.open) {
      returnFocusRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      dialog.showModal();
    }
    if (!isOpen && dialog.open) {
      // Elements outside a modal dialog are inert, so focus moves only after
      // it has closed.
      dialog.close();
      const target = isCancellingRef.current
        ? returnFocusRef.current
        : focusAfterConfirmRef.current;
      isCancellingRef.current = false;
      if (target !== null && target.isConnected) {
        target.focus();
      }
    }
  }, [isOpen, focusAfterConfirmRef]);

  function cancel() {
    isCancellingRef.current = true;
    onCancel();
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      // Escape closes a native dialog; route it through onCancel so the
      // parent's state stays the source of truth.
      onCancel={(event) => {
        event.preventDefault();
        cancel();
      }}
      className="m-auto w-full max-w-xl rounded-lg border border-border bg-surface p-4 text-text shadow-lg backdrop:bg-canvas/75 md:p-6"
    >
      <div className="flex flex-col gap-4">
        <h2 id={titleId} className="text-lg font-semibold">
          {title}
        </h2>
        <div id={bodyId} className="text-sm">
          {children}
        </div>
        {error !== null && (
          <p
            role="alert"
            className="flex items-center gap-2 text-sm text-missed"
          >
            <CircleAlert size={16} aria-hidden="true" />
            {error}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={cancel}
            className={BUTTON_CLASSES.secondary}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isBusy}
            className={BUTTON_CLASSES[confirmVariant]}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
