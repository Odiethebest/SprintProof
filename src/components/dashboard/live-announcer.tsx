"use client";

import { useEffect, useState } from "react";
import { TOAST_DURATION_MS, Toast } from "@/components/ui/toast";

export interface LiveUpdateView {
  // Changes whenever the item does, e.g. a commit group that gains a commit.
  key: string;
  message: string;
}

function toSignature(updates: LiveUpdateView[]): string {
  return updates.map((update) => update.key).join("\n");
}

// The dashboard's polite live region (AGENTS.md §2 LiveIndicator). After a
// live refetch it announces the newest item that wasn't on the page before.
// Remount it when the sprint changes, so switching sprints announces nothing.
export function LiveAnnouncer({ updates }: { updates: LiveUpdateView[] }) {
  const [shownSignature, setShownSignature] = useState(() =>
    toSignature(updates)
  );
  const [seenKeys, setSeenKeys] = useState(
    () => new Set(updates.map((update) => update.key))
  );
  const [message, setMessage] = useState<string | null>(null);

  const signature = toSignature(updates);
  if (signature !== shownSignature) {
    const newest = updates.find((update) => !seenKeys.has(update.key));
    setShownSignature(signature);
    setSeenKeys(new Set(updates.map((update) => update.key)));
    if (newest !== undefined) {
      setMessage(newest.message);
    }
  }

  useEffect(() => {
    if (message === null) {
      return;
    }
    const timer = setTimeout(() => setMessage(null), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [message]);

  return <Toast message={message} />;
}
