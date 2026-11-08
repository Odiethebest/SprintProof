import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

// DESIGN.md §7 EmptyState: bordered box, centered 24 px muted icon, one line,
// at most one action link.
export function EmptyState({
  Icon,
  children,
}: {
  Icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-md border border-border p-6 text-center">
      <Icon size={24} aria-hidden="true" className="text-text-muted" />
      {children}
    </div>
  );
}

// The action link inside an EmptyState.
export const EMPTY_STATE_LINK_CLASSES =
  "rounded-sm text-sm text-primary underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface";
