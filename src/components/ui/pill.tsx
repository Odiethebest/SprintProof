import type { ReactNode } from "react";

// DESIGN.md §7: roles, "Read-only", retro Open/Closed. Never uses status colors.
export function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border px-2 py-1 text-xs text-text-muted">
      {children}
    </span>
  );
}
