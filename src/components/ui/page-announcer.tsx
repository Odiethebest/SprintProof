"use client";

import { createContext, use, useEffect, useState, type ReactNode } from "react";
import { TOAST_DURATION_MS, Toast } from "./toast";

const AnnounceContext = createContext<((message: string) => void) | null>(null);

// DESIGN.md §10: one polite live region per page. A form's confirmation and a
// teammate's live update go through the same Toast, so a screen reader hears
// them in one queue and the page never has two regions (#77).
export function PageAnnouncer({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (message === null) {
      return;
    }
    const timer = setTimeout(() => setMessage(null), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [message]);

  return (
    <AnnounceContext value={setMessage}>
      {children}
      <Toast message={message} />
    </AnnounceContext>
  );
}

// Shows a message in the page's Toast and announces it politely.
export function useAnnounce(): (message: string) => void {
  const announce = use(AnnounceContext);
  if (announce === null) {
    throw new Error("useAnnounce() needs a PageAnnouncer above it.");
  }
  return announce;
}
