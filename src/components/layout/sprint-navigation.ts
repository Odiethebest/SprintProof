import { z } from "zod";
import {
  listStartedSprints,
  type SelectableSprint,
  type SprintDateRange,
} from "@/lib/sprints";
import type { SprintOptionView } from "./sprint-selector";

const searchParamsSchema = z.object({
  sprint: z.string().min(1).max(64).optional(),
});

// The sprint picked in the selector (`?sprint=`). A missing, repeated or empty
// value means no choice, and the page shows its default sprint.
export function readRequestedSprintId(searchParams: unknown): string | null {
  const parsed = searchParamsSchema.safeParse(searchParams);
  return parsed.success ? (parsed.data.sprint ?? null) : null;
}

// "Nov 4" for a YYYY-MM-DD date (DESIGN.md §9). The date is already the team's
// calendar day, so it's formatted in UTC to keep it from shifting.
const SHORT_DATE = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

export function formatShortDate(date: string): string {
  return SHORT_DATE.format(new Date(`${date}T00:00:00.000Z`));
}

// "Oct 29 – Nov 4"
export function formatDateRange({ startDate, endDate }: SprintDateRange) {
  return `${formatShortDate(startDate)} – ${formatShortDate(endDate)}`;
}

// Options for the top bar's sprint selector: "Sprint 1 · Oct 29 – Nov 4 · Current".
// Null when no sprint has started, so there's nothing to pick.
export function buildSprintSelector({
  sprints,
  selectedId,
  now,
  timeZone,
}: {
  sprints: ReadonlyArray<SelectableSprint & { name: string }>;
  selectedId: string | null;
  now: Date;
  timeZone: string;
}): { options: SprintOptionView[]; selectedId: string } | null {
  if (selectedId === null) {
    return null;
  }
  const options = listStartedSprints({ sprints, now, timeZone }).map(
    (sprint) => ({
      id: sprint.id,
      label: `${sprint.name} · ${formatDateRange(sprint)} · ${sprint.state === "CURRENT" ? "Current" : "Ended"}`,
    })
  );
  return { options, selectedId };
}
