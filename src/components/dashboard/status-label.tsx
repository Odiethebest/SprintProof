import {
  CircleCheck,
  CircleX,
  Clock,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import type { RequirementStatus } from "@/lib/checks";

// DESIGN.md §3: status is always an icon, a text label and a color, never color alone.
export const STATUS_DISPLAY: Record<
  RequirementStatus,
  { label: string; Icon: LucideIcon; colorClass: string }
> = {
  MET: { label: "Met", Icon: CircleCheck, colorClass: "text-met" },
  ON_TRACK: { label: "On track", Icon: Clock, colorClass: "text-on-track" },
  AT_RISK: {
    label: "At risk",
    Icon: TriangleAlert,
    colorClass: "text-at-risk",
  },
  MISSED: { label: "Missed", Icon: CircleX, colorClass: "text-missed" },
};

export function StatusLabel({ status }: { status: RequirementStatus }) {
  const { label, Icon, colorClass } = STATUS_DISPLAY[status];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 text-sm font-medium ${colorClass}`}
    >
      <Icon size={16} aria-hidden="true" />
      {label}
    </span>
  );
}
