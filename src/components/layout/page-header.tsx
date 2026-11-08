import type { ReactNode } from "react";

// DESIGN.md §6: title and muted meta line on the left, at most one action on the right.
export function PageHeader({
  title,
  meta,
  action,
}: {
  title: string;
  meta: ReactNode;
  action: ReactNode | null;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-muted">
          {meta}
        </p>
      </div>
      {action}
    </div>
  );
}
