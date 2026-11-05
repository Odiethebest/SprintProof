"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, Copy, Plus } from "lucide-react";
import type { InviteRole } from "@/lib/invites/invite-link";
import {
  NETWORK_ERROR_MESSAGE,
  readApiError,
} from "@/components/teams/api-error";
import { BUTTON_CLASSES } from "@/components/ui/button-styles";

export interface InviteLinkView {
  role: InviteRole;
  // The active link for this role, or null when there is none.
  invite: { id: string; url: string; expiresLabel: string } | null;
}

const ROLE_TITLES: Record<InviteRole, string> = {
  MEMBER: "Member invite link",
  INSTRUCTOR: "Instructor invite link",
};

const ROLE_NAMES: Record<InviteRole, string> = {
  MEMBER: "member",
  INSTRUCTOR: "instructor",
};

// Lead only. One status region for both panels, so copy and revoke results
// are announced politely (AGENTS.md §4 Accessibility).
export function InviteLinks({
  teamId,
  links,
}: {
  teamId: string;
  links: InviteLinkView[];
}) {
  const router = useRouter();
  const [announcement, setAnnouncement] = useState("");
  const [errors, setErrors] = useState<Partial<Record<InviteRole, string>>>({});
  const [busyRole, setBusyRole] = useState<InviteRole | null>(null);
  const [copiedRole, setCopiedRole] = useState<InviteRole | null>(null);

  async function send(
    role: InviteRole,
    request: () => Promise<Response>,
    doneMessage: string
  ) {
    setErrors((current) => ({ ...current, [role]: undefined }));
    setBusyRole(role);
    try {
      const response = await request();
      if (response.ok) {
        setAnnouncement(doneMessage);
        router.refresh();
      } else {
        const { message } = await readApiError(response);
        setErrors((current) => ({ ...current, [role]: message }));
      }
    } catch {
      setErrors((current) => ({ ...current, [role]: NETWORK_ERROR_MESSAGE }));
    }
    setBusyRole(null);
  }

  function createLink(role: InviteRole) {
    return send(
      role,
      () =>
        fetch(`/api/v1/teams/${teamId}/invites`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ role }),
        }),
      `New ${ROLE_NAMES[role]} invite link created.`
    );
  }

  function revokeLink(role: InviteRole, inviteId: string) {
    return send(
      role,
      () =>
        fetch(`/api/v1/teams/${teamId}/invites/${inviteId}`, {
          method: "DELETE",
        }),
      `${ROLE_TITLES[role]} revoked.`
    );
  }

  async function copyLink(role: InviteRole, url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedRole(role);
      setAnnouncement(`${ROLE_TITLES[role]} copied.`);
    } catch {
      setErrors((current) => ({
        ...current,
        [role]: "Couldn't copy. Select the link and copy it instead.",
      }));
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {links.map(({ role, invite }) => (
        <section
          key={role}
          aria-labelledby={`invite-${role}`}
          className="flex flex-col gap-3 rounded-md border border-border p-3"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 id={`invite-${role}`} className="text-sm font-semibold">
              {ROLE_TITLES[role]}
            </h3>
            {invite && (
              <p className="font-mono text-xs text-text-muted tabular-nums">
                Expires {invite.expiresLabel}
              </p>
            )}
          </div>
          {invite ? (
            <>
              <p className="break-all rounded-md border border-border bg-canvas px-2 py-1 font-mono text-xs">
                {invite.url}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => copyLink(role, invite.url)}
                  className={BUTTON_CLASSES.secondary}
                >
                  <Copy size={16} aria-hidden="true" />
                  {copiedRole === role ? "Copied" : "Copy link"}
                </button>
                <button
                  type="button"
                  onClick={() => revokeLink(role, invite.id)}
                  disabled={busyRole === role}
                  className={BUTTON_CLASSES.destructive}
                >
                  Revoke
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-text-muted">No active link.</p>
              <button
                type="button"
                onClick={() => createLink(role)}
                disabled={busyRole === role}
                className={BUTTON_CLASSES.secondary}
              >
                <Plus size={16} aria-hidden="true" />
                Create link
              </button>
            </div>
          )}
          {errors[role] && (
            <p
              role="alert"
              className="flex items-center gap-2 text-sm text-missed"
            >
              <CircleAlert size={16} aria-hidden="true" />
              {errors[role]}
            </p>
          )}
        </section>
      ))}
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}
