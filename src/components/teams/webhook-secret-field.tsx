"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, Copy, RefreshCw } from "lucide-react";
import {
  NETWORK_ERROR_MESSAGE,
  readApiError,
} from "@/components/teams/api-error";
import { BUTTON_CLASSES } from "@/components/ui/button-styles";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export interface WebhookSecretView {
  // The full secret, for "Copy" only: the lead pastes it into GitHub. The page
  // passes it to the lead and nobody else (decision 005, #115).
  secret: string;
  last4: string;
  // The team's GitHub webhook may still sign with the server-wide secret.
  canUseServerWebhookSecret: boolean;
}

// Settings → Repository → Webhook secret, lead only (AGENTS.md §2 Settings):
// masked to its last 4 characters, "Copy" and "Rotate secret".
export function WebhookSecretField({
  teamId,
  webhookSecret,
}: {
  teamId: string;
  webhookSecret: WebhookSecretView;
}) {
  const router = useRouter();
  const rotateRef = useRef<HTMLButtonElement>(null);
  // Which secret was copied, so "Copied" goes back to "Copy" after a rotation.
  const [copiedSecret, setCopiedSecret] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [isConfirming, setIsConfirming] = useState(false);
  const [rotateError, setRotateError] = useState<string | null>(null);
  const [isRotating, setIsRotating] = useState(false);
  const isCopied = copiedSecret === webhookSecret.secret;

  async function copySecret() {
    setCopyError(null);
    try {
      await navigator.clipboard.writeText(webhookSecret.secret);
      setCopiedSecret(webhookSecret.secret);
      setAnnouncement("Webhook secret copied.");
    } catch {
      setCopyError(
        "Couldn't copy. Allow copying in this browser and try again."
      );
    }
  }

  function closeDialog() {
    setIsConfirming(false);
    setRotateError(null);
  }

  async function rotateSecret() {
    setRotateError(null);
    setIsRotating(true);
    try {
      const response = await fetch(`/api/v1/teams/${teamId}/webhook-secret`, {
        method: "POST",
      });
      if (response.ok) {
        closeDialog();
        setAnnouncement(
          "Webhook secret rotated. Paste the new one into GitHub."
        );
        router.refresh();
      } else {
        setRotateError((await readApiError(response)).message);
      }
    } catch {
      setRotateError(NETWORK_ERROR_MESSAGE);
    }
    setIsRotating(false);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-text">Webhook secret</span>
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs">
          <span className="sr-only">Ends in </span>
          <span
            data-testid="webhook-secret-masked"
            className="rounded-md border border-border bg-canvas px-2 py-1 font-mono text-xs"
          >
            <span aria-hidden="true">••••••••</span>
            {webhookSecret.last4}
          </span>
        </p>
        <button
          type="button"
          onClick={copySecret}
          className={BUTTON_CLASSES.secondary}
        >
          <Copy size={16} aria-hidden="true" />
          {isCopied ? "Copied" : "Copy"}
          <span className="sr-only"> webhook secret</span>
        </button>
        <button
          ref={rotateRef}
          type="button"
          onClick={() => setIsConfirming(true)}
          className={BUTTON_CLASSES.secondary}
        >
          <RefreshCw size={16} aria-hidden="true" />
          Rotate secret
        </button>
      </div>
      {webhookSecret.canUseServerWebhookSecret && (
        <p className="text-xs text-text-muted">
          Until GitHub sends a delivery signed with this secret, deliveries
          signed with the server-wide secret are accepted too.
        </p>
      )}
      {copyError !== null && (
        <p role="alert" className="flex items-center gap-2 text-sm text-missed">
          <CircleAlert size={16} aria-hidden="true" />
          {copyError}
        </p>
      )}

      <ConfirmDialog
        isOpen={isConfirming}
        title="Rotate the webhook secret?"
        confirmLabel="Rotate secret"
        isBusy={isRotating}
        error={rotateError}
        onConfirm={() => void rotateSecret()}
        onCancel={closeDialog}
        // The trigger stays on the page, so focus goes back to it either way.
        focusAfterConfirmRef={rotateRef}
      >
        <p>
          GitHub&apos;s deliveries fail until you paste the new secret into the
          webhook on GitHub.
        </p>
      </ConfirmDialog>

      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}
