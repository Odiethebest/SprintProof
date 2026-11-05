"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert } from "lucide-react";
import {
  NETWORK_ERROR_MESSAGE,
  readApiError,
} from "@/components/teams/api-error";
import { BUTTON_CLASSES } from "@/components/ui/button-styles";

// Joining is a POST to the API: opening the invite page never changes anything.
export function JoinTeamButton({ inviteToken }: { inviteToken: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);

  async function handleClick() {
    setError(null);
    setIsJoining(true);
    try {
      const response = await fetch("/api/v1/memberships", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ inviteToken }),
      });
      if (response.ok) {
        // TODO(#12): go to the team dashboard once it exists.
        router.push("/");
        return;
      }
      setError((await readApiError(response)).message);
    } catch {
      setError(NETWORK_ERROR_MESSAGE);
    }
    setIsJoining(false);
  }

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <button
        type="button"
        onClick={handleClick}
        disabled={isJoining}
        className={BUTTON_CLASSES.primary}
      >
        Join team
      </button>
      {error && (
        <p role="alert" className="flex items-center gap-2 text-sm text-missed">
          <CircleAlert size={16} aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  );
}
