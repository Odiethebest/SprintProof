import type { ReactNode } from "react";
import { MessageSquare } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";

export interface StandupEntryView {
  id: string;
  authorName: string;
  timeLabel: string;
  isEdited: boolean;
  yesterday: string;
  today: string;
  blockers: string | null;
}

export interface StandupDayView {
  date: string;
  dayLabel: string;
  standups: StandupEntryView[];
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-md border border-border p-6 text-center">
      <MessageSquare size={24} aria-hidden="true" className="text-text-muted" />
      {children}
    </div>
  );
}

function StandupAnswer({
  label,
  answer,
}: {
  label: string;
  answer: string | null;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-xs text-text-muted">{label}</dt>
      {answer === null ? (
        <dd className="text-sm text-text-muted">None</dd>
      ) : (
        // Keeps the line breaks people typed.
        <dd className="whitespace-pre-line break-words text-sm">{answer}</dd>
      )}
    </div>
  );
}

function StandupEntry({ standup }: { standup: StandupEntryView }) {
  return (
    <li className="flex flex-col gap-3 rounded-md border border-border p-4">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar name={standup.authorName} size="md" />
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium">
            {standup.authorName}
          </span>
          <span className="font-mono text-xs text-text-muted tabular-nums">
            {standup.timeLabel}
            {standup.isEdited && " · edited"}
          </span>
        </div>
      </div>
      <dl className="grid gap-3 sm:grid-cols-3">
        <StandupAnswer label="Yesterday" answer={standup.yesterday} />
        <StandupAnswer label="Today" answer={standup.today} />
        <StandupAnswer label="Blockers" answer={standup.blockers} />
      </dl>
    </li>
  );
}

// AGENTS.md §2 Standups: grouped by day, newest first, with a count per day.
// The review page lists a sprint's standups the same way.
export function StandupDayList({ days }: { days: StandupDayView[] }) {
  return (
    <div className="flex flex-col gap-6">
      {days.map((day) => (
        <div key={day.date} className="flex flex-col gap-3">
          <h3 className="flex items-baseline gap-2">
            <span className="font-mono text-sm font-semibold">
              {day.dayLabel}
            </span>
            <span className="text-xs text-text-muted">
              {day.standups.length === 1
                ? "1 standup"
                : `${day.standups.length} standups`}
            </span>
          </h3>
          <ul className="flex flex-col gap-3">
            {day.standups.map((standup) => (
              <StandupEntry key={standup.id} standup={standup} />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function StandupHistory({
  sprintName,
  days,
  canPost,
}: {
  sprintName: string | null;
  days: StandupDayView[];
  canPost: boolean;
}) {
  return (
    <section
      aria-labelledby="standup-history-title"
      className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 md:p-6"
    >
      <div className="flex flex-col gap-1">
        <h2 id="standup-history-title" className="text-lg font-semibold">
          History
        </h2>
        {sprintName !== null && (
          <p className="text-xs text-text-muted">{sprintName}, newest first</p>
        )}
      </div>
      {sprintName === null ? (
        <EmptyState>
          <p className="text-sm text-text-muted">No sprint is running today.</p>
        </EmptyState>
      ) : days.length === 0 ? (
        <EmptyState>
          <p className="text-sm text-text-muted">
            No standups in {sprintName} yet.
          </p>
          {canPost && (
            <a
              href="#todays-standup"
              className="rounded-sm text-sm text-primary underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
            >
              Post today&apos;s standup
            </a>
          )}
        </EmptyState>
      ) : (
        <StandupDayList days={days} />
      )}
    </section>
  );
}
