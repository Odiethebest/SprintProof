export interface OrderedSprint {
  id: string;
  // YYYY-MM-DD
  startDate: string;
}

// The sprint that starts next after this one, which a closing retro's action
// items go to (rule R6). Sprints never overlap, so start dates order them.
export function findNextSprint<T extends OrderedSprint>({
  sprint,
  sprints,
}: {
  sprint: OrderedSprint;
  sprints: readonly T[];
}): T | null {
  let next: T | null = null;
  for (const other of sprints) {
    const isLater = other.startDate > sprint.startDate;
    if (isLater && (next === null || other.startDate < next.startDate)) {
      next = other;
    }
  }
  return next;
}
