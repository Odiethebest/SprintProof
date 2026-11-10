"use client";

import { useRef, useState, type FormEvent } from "react";
import { flushSync } from "react-dom";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { CircleAlert, Copy, KeyRound, Plus } from "lucide-react";
import { createApiTokenSchema } from "@/lib/api-tokens/api-token-name";
import {
  NETWORK_ERROR_MESSAGE,
  readApiError,
} from "@/components/teams/api-error";
import { BUTTON_CLASSES } from "@/components/ui/button-styles";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";

export interface ApiTokenView {
  id: string;
  name: string;
  maskedToken: string;
  createdLabel: string;
  // null until the token is used for the first time.
  lastUsedLabel: string | null;
}

// DESIGN.md §7 Forms: the border turns `missed` on error.
const INPUT_CLASSES = {
  valid:
    "h-9 w-full rounded-md border border-form-control-border bg-surface px-3 text-sm placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
  invalid:
    "h-9 w-full rounded-md border border-missed bg-surface px-3 text-sm placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
} as const;

const createdTokenSchema = z.object({
  id: z.string().min(1),
  token: z.string().min(1),
});

const NAME_INPUT_ID = "new-api-token-name";
const NAME_ERROR_ID = "new-api-token-name-error";

// Settings "API tokens" (AGENTS.md §2): the signed-in user's own tokens, for
// every role. A new token is shown once, until dismissed or revoked.
export function ApiTokensCard({ tokens }: { tokens: ApiTokenView[] }) {
  const router = useRouter();
  const nameRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newToken, setNewToken] = useState<{
    id: string;
    token: string;
  } | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [revoking, setRevoking] = useState<ApiTokenView | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);

  // Render the error first, so aria-describedby points at it when the field
  // gets focus and a screen reader reads it (#77).
  function showNameError(message: string) {
    flushSync(() => setNameError(message));
    nameRef.current?.focus();
  }

  // Done goes away with the token box, so focus moves to the name field.
  function dismissNewToken() {
    setNewToken(null);
    nameRef.current?.focus();
  }

  async function createToken(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const parsed = createApiTokenSchema.safeParse({ name });
    if (!parsed.success) {
      showNameError(parsed.error.issues[0]?.message ?? "Name the token.");
      return;
    }
    setNameError(null);
    setIsCreating(true);
    try {
      const response = await fetch("/api/v1/tokens", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      if (response.ok) {
        const created = createdTokenSchema.safeParse(
          await response.json().catch(() => null)
        );
        setNewToken(created.success ? created.data : null);
        setIsCopied(false);
        setName("");
        if (created.success) {
          setAnnouncement("Token created. Copy it now.");
        } else {
          setFormError(
            "Token created, but it couldn't be shown. Revoke it and create another."
          );
        }
        router.refresh();
      } else {
        const { code, message } = await readApiError(response);
        if (code === "VALIDATION_ERROR") {
          showNameError(message);
        } else {
          setFormError(message);
        }
      }
    } catch {
      setFormError(NETWORK_ERROR_MESSAGE);
    }
    setIsCreating(false);
  }

  async function copyToken(token: string) {
    try {
      await navigator.clipboard.writeText(token);
      setIsCopied(true);
      setAnnouncement("Token copied.");
    } catch {
      setFormError("Couldn't copy. Select the token and copy it instead.");
    }
  }

  function closeRevokeDialog() {
    setRevoking(null);
    setRevokeError(null);
  }

  async function revokeToken(token: ApiTokenView) {
    setRevokeError(null);
    setIsRevoking(true);
    try {
      const response = await fetch(`/api/v1/tokens/${token.id}`, {
        method: "DELETE",
      });
      // 404: already revoked elsewhere, so the list just needs a refresh.
      if (response.ok || response.status === 404) {
        if (newToken?.id === token.id) {
          setNewToken(null);
        }
        closeRevokeDialog();
        setAnnouncement(`${token.name} revoked.`);
        router.refresh();
      } else {
        setRevokeError((await readApiError(response)).message);
      }
    } catch {
      setRevokeError(NETWORK_ERROR_MESSAGE);
    }
    setIsRevoking(false);
  }

  return (
    <section
      aria-labelledby="api-tokens-title"
      className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 md:p-6"
    >
      <div className="flex flex-col gap-1">
        <h2 id="api-tokens-title" className="text-lg font-semibold">
          API tokens
        </h2>
        <p className="text-xs text-text-muted">
          For the REST API under <code className="font-mono">/api/v1</code>,
          documented in <code className="font-mono">docs/api/openapi.yaml</code>
        </p>
      </div>

      {newToken !== null && (
        <div className="flex flex-col gap-3 rounded-md border border-primary bg-primary/10 p-3">
          <p className="text-sm font-medium">
            Copy your new token now. You won&apos;t see it again.
          </p>
          <code
            data-testid="new-api-token"
            className="break-all rounded-md border border-border bg-canvas px-2 py-1 font-mono text-xs"
          >
            {newToken.token}
          </code>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => copyToken(newToken.token)}
              className={BUTTON_CLASSES.secondary}
            >
              <Copy size={16} aria-hidden="true" />
              {isCopied ? "Copied" : "Copy token"}
            </button>
            <button
              type="button"
              onClick={dismissNewToken}
              className={BUTTON_CLASSES.secondary}
            >
              Done
            </button>
          </div>
        </div>
      )}

      {tokens.length === 0 ? (
        <EmptyState Icon={KeyRound}>
          <p className="text-sm text-text-muted">No API tokens yet.</p>
        </EmptyState>
      ) : (
        <ul className="divide-y divide-border">
          {tokens.map((token) => (
            <li
              key={token.id}
              className="flex flex-wrap items-center justify-between gap-3 py-3"
            >
              <div className="flex min-w-0 items-start gap-3">
                <KeyRound
                  size={16}
                  aria-hidden="true"
                  className="mt-0.5 shrink-0 text-text-muted"
                />
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium">
                    {token.name}
                  </span>
                  <span className="font-mono text-xs text-text-muted">
                    {token.maskedToken} · created {token.createdLabel} ·{" "}
                    {token.lastUsedLabel === null
                      ? "not used yet"
                      : `last used ${token.lastUsedLabel}`}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRevoking(token)}
                className={BUTTON_CLASSES.destructive}
              >
                Revoke<span className="sr-only"> {token.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <form
        noValidate
        onSubmit={createToken}
        className="flex flex-col gap-1 border-t border-border pt-4"
      >
        <label htmlFor={NAME_INPUT_ID} className="text-sm font-medium">
          New token name
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            ref={nameRef}
            id={NAME_INPUT_ID}
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="For example, grading script"
            aria-invalid={nameError !== null ? true : undefined}
            aria-describedby={nameError !== null ? NAME_ERROR_ID : undefined}
            className={
              nameError !== null ? INPUT_CLASSES.invalid : INPUT_CLASSES.valid
            }
          />
          <button
            type="submit"
            disabled={isCreating}
            className={BUTTON_CLASSES.secondary}
          >
            <Plus size={16} aria-hidden="true" />
            Create token
          </button>
        </div>
        {nameError !== null && (
          <p
            id={NAME_ERROR_ID}
            className="flex items-center gap-1 text-xs text-missed"
          >
            <CircleAlert size={12} aria-hidden="true" />
            {nameError}
          </p>
        )}
        {formError !== null && (
          <p
            role="alert"
            className="flex items-center gap-2 text-sm text-missed"
          >
            <CircleAlert size={16} aria-hidden="true" />
            {formError}
          </p>
        )}
      </form>

      <ConfirmDialog
        isOpen={revoking !== null}
        title={`Revoke ${revoking?.name ?? "token"}?`}
        confirmLabel="Revoke token"
        isBusy={isRevoking}
        error={revokeError}
        onConfirm={() => {
          if (revoking !== null) {
            void revokeToken(revoking);
          }
        }}
        onCancel={closeRevokeDialog}
        // The revoked row and its button go away, so focus moves to the form.
        focusAfterConfirmRef={nameRef}
      >
        <p>Scripts that use this token stop working right away.</p>
      </ConfirmDialog>

      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </section>
  );
}
