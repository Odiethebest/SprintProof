"use client";

import { useEffect, useRef, useState } from "react";
import { useAnnounce } from "@/components/ui/page-announcer";

export interface LiveUpdateView {
  // Changes whenever the item does, e.g. a commit group that gains a commit.
  key: string;
  message: string;
}

function toSignature(updates: LiveUpdateView[]): string {
  return updates.map((update) => update.key).join("\n");
}

// Live update announcements (AGENTS.md §2 LiveIndicator) for the dashboard and
// the Standups page. After a live refetch it announces, through the page's
// PageAnnouncer, the newest item that wasn't on the page before. Remount it
// when the sprint changes, so switching sprints announces nothing.
export function LiveAnnouncer({ updates }: { updates: LiveUpdateView[] }) {
  const announce = useAnnounce();
  const [shownSignature, setShownSignature] = useState(() =>
    toSignature(updates)
  );
  const [seenKeys, setSeenKeys] = useState(
    () => new Set(updates.map((update) => update.key))
  );
  // An object, so the same text arriving twice is announced twice.
  const [latest, setLatest] = useState<{ message: string } | null>(null);
  // Effects run again when Back or Forward shows a page that Cache Components
  // kept hidden, so remember what was announced instead of repeating it.
  const announced = useRef<{ message: string } | null>(null);

  const signature = toSignature(updates);
  if (signature !== shownSignature) {
    const newest = updates.find((update) => !seenKeys.has(update.key));
    setShownSignature(signature);
    setSeenKeys(new Set(updates.map((update) => update.key)));
    if (newest !== undefined) {
      setLatest({ message: newest.message });
    }
  }

  // The region belongs to PageAnnouncer, a parent, so it's updated after
  // render rather than during it.
  useEffect(() => {
    if (latest !== null && latest !== announced.current) {
      announced.current = latest;
      announce(latest.message);
    }
  }, [latest, announce]);

  return null;
}
