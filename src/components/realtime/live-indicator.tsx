"use client";

import { useLiveState, type LiveState } from "./team-live-provider";

const LIVE_STATE_DISPLAY: Record<
  LiveState,
  { label: string; textClass: string; dotClass: string }
> = {
  LIVE: {
    label: "Live",
    textClass: "text-met",
    dotClass: "bg-met motion-safe:animate-pulse",
  },
  // Before the first connection there's nothing to reconnect to yet.
  CONNECTING: {
    label: "Connecting…",
    textClass: "text-text-muted",
    dotClass: "bg-text-muted",
  },
  RECONNECTING: {
    label: "Reconnecting…",
    textClass: "text-text-muted",
    dotClass: "bg-text-muted",
  },
};

// DESIGN.md §7 LiveIndicator. Not a live region: the page's one polite region
// announces updates, and a connection blip isn't worth interrupting for.
export function LiveIndicator() {
  const liveState = useLiveState();
  if (liveState === null) {
    return null;
  }
  const { label, textClass, dotClass } = LIVE_STATE_DISPLAY[liveState];
  return (
    <p
      className={`flex shrink-0 items-center gap-2 text-xs font-medium ${textClass}`}
    >
      <span aria-hidden="true" className={`size-2 rounded-full ${dotClass}`} />
      {label}
    </p>
  );
}
