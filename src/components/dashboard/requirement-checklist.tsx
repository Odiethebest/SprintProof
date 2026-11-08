import type { RequirementProgress } from "@/lib/checks";
import { STATUS_DISPLAY } from "./status-label";

function ChecklistRow({
  label,
  progress,
  isSprintRunning,
}: {
  label: string;
  progress: RequirementProgress;
  isSprintRunning: boolean;
}) {
  const {
    label: statusLabel,
    Icon,
    colorClass,
  } = STATUS_DISPLAY[progress.status];
  const isOpen = progress.status !== "MET";
  return (
    // DESIGN.md §3 row format: <icon> Standups  2 / 3  · On track · 1 to go
    <li className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
      <Icon size={16} aria-hidden="true" className={colorClass} />
      <span className="font-medium">{label}</span>
      <span aria-hidden="true" className="font-mono tabular-nums">
        {progress.count} / {progress.required}
      </span>
      {/* Screen readers hear "2 of 3" (AGENTS.md §2 RequirementChecklist). */}
      <span className="sr-only">
        {progress.count} of {progress.required}
      </span>
      <span aria-hidden="true" className="text-text-muted">
        ·
      </span>
      <span className={`font-medium ${colorClass}`}>{statusLabel}</span>
      {isOpen && isSprintRunning && (
        <>
          <span aria-hidden="true" className="text-text-muted">
            ·
          </span>
          <span className="text-text-muted">{progress.remaining} to go</span>
        </>
      )}
    </li>
  );
}

export function RequirementChecklist({
  standups,
  reviews,
  isSprintRunning,
}: {
  standups: RequirementProgress;
  reviews: RequirementProgress;
  isSprintRunning: boolean;
}) {
  return (
    <ul className="flex flex-col gap-3">
      <ChecklistRow
        label="Standups"
        progress={standups}
        isSprintRunning={isSprintRunning}
      />
      <ChecklistRow
        label="PR reviews"
        progress={reviews}
        isSprintRunning={isSprintRunning}
      />
    </ul>
  );
}
