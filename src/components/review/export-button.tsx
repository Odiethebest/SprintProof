"use client";

import { useId, useRef, useState } from "react";
import { CircleAlert, Copy, Download } from "lucide-react";
import type { ExportAudience } from "@/lib/export/sprint-summary-markdown";
import { BUTTON_CLASSES } from "@/components/ui/button-styles";

// What the file holds (AGENTS.md §2 ExportButton).
const AUDIENCE_NOTES: Record<ExportAudience, string> = {
  TEAM: "Team export. Peer feedback is left out.",
  INSTRUCTOR: "Instructor export. Includes peer feedback.",
};

// "Export Markdown" opens a native dialog with a preview, "Copy Markdown" and
// "Download" (DESIGN.md §7 Dialog). The Markdown is built on the server; the
// file is a Blob made here, so nothing is sent anywhere.
export function ExportButton({
  fileName,
  markdown,
  audience,
}: {
  fileName: string;
  markdown: string;
  audience: ExportAudience;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const titleId = useId();
  const noteId = useId();
  const previewLabelId = useId();

  function open() {
    setIsCopied(false);
    setCopyError(null);
    dialogRef.current?.showModal();
  }

  async function copyMarkdown() {
    setCopyError(null);
    try {
      await navigator.clipboard.writeText(markdown);
      setIsCopied(true);
    } catch {
      setCopyError("Couldn't copy. Select the preview and copy it instead.");
    }
  }

  function downloadMarkdown() {
    const url = URL.createObjectURL(
      new Blob([markdown], { type: "text/markdown;charset=utf-8" })
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    // The download starts after the click returns; revoking the URL right
    // away can cancel it.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={open}
        className={BUTTON_CLASSES.primary}
      >
        <Download size={16} aria-hidden="true" />
        Export Markdown
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        aria-describedby={noteId}
        // Escape and Close both end here. Elements outside a modal dialog are
        // inert, so focus can go back to the trigger only once it has closed.
        onClose={() => triggerRef.current?.focus()}
        className="m-auto w-full max-w-xl rounded-lg border border-border bg-surface p-4 text-text shadow-lg backdrop:bg-canvas/75 md:p-6"
      >
        <div className="flex flex-col gap-4">
          <h2 id={titleId} className="text-lg font-semibold">
            {fileName}
          </h2>
          <p id={noteId} className="text-sm text-text-muted">
            {AUDIENCE_NOTES[audience]}
          </p>
          <div className="flex flex-col gap-1">
            <p id={previewLabelId} className="text-xs text-text-muted">
              Preview
            </p>
            {/* Focusable, so the preview scrolls with the keyboard too. */}
            <div
              role="region"
              aria-labelledby={previewLabelId}
              tabIndex={0}
              className="max-h-80 overflow-auto rounded-md border border-border bg-canvas p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            >
              <pre className="whitespace-pre-wrap break-words font-mono text-xs">
                {markdown}
              </pre>
            </div>
          </div>
          {copyError !== null && (
            <p
              role="alert"
              className="flex items-center gap-2 text-sm text-missed"
            >
              <CircleAlert size={16} aria-hidden="true" />
              {copyError}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className={BUTTON_CLASSES.secondary}
            >
              Close
            </button>
            <button
              type="button"
              onClick={copyMarkdown}
              className={BUTTON_CLASSES.secondary}
            >
              <Copy size={16} aria-hidden="true" />
              {isCopied ? "Copied" : "Copy Markdown"}
            </button>
            <button
              type="button"
              onClick={downloadMarkdown}
              className={BUTTON_CLASSES.primary}
            >
              <Download size={16} aria-hidden="true" />
              Download
            </button>
          </div>
          <p role="status" className="sr-only">
            {isCopied ? "Markdown copied." : ""}
          </p>
        </div>
      </dialog>
    </>
  );
}
