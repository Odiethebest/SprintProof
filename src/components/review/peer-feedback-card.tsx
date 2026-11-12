import { Lock, MessageSquare } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

// One author's feedback about one teammate, as the card shows it.
export interface PeerFeedbackEntryView {
  id: string;
  // "Ziqi (Odie) Yang about Yunhong Huang"
  title: string;
  // null until the author saves feedback about this teammate.
  text: string | null;
  // "Oct 31" in the team's timezone; null with no feedback.
  updatedOnLabel: string | null;
}

// AGENTS.md §2 Review "Peer feedback", for instructors only (PRD R7): one
// entry per author and teammate, or "Not submitted yet".
export function PeerFeedbackCard({
  entries,
}: {
  entries: PeerFeedbackEntryView[];
}) {
  return (
    <section
      aria-labelledby="review-peer-feedback-title"
      className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 md:p-6"
    >
      <div className="flex flex-col gap-1">
        <h2 id="review-peer-feedback-title" className="text-lg font-semibold">
          Peer feedback
        </h2>
        <p className="flex items-center gap-1 text-xs text-text-muted">
          <Lock size={12} aria-hidden="true" />
          Visible only to instructors.
        </p>
      </div>
      {entries.length === 0 ? (
        <EmptyState Icon={MessageSquare}>
          <p className="text-sm text-text-muted">
            The team has one member, so there&apos;s no partner feedback.
          </p>
        </EmptyState>
      ) : (
        <div className="grid items-start gap-4 md:grid-cols-2">
          {entries.map((entry) => {
            const titleId = `review-peer-feedback-${entry.id}`;
            return (
              <article
                key={entry.id}
                aria-labelledby={titleId}
                className="flex flex-col gap-2 rounded-md border border-border p-4"
              >
                <h3 id={titleId} className="text-sm font-semibold">
                  {entry.title}
                </h3>
                {entry.text === null ? (
                  <p className="text-sm text-text-muted">Not submitted yet.</p>
                ) : (
                  <p className="whitespace-pre-wrap break-words text-sm">
                    {entry.text}
                  </p>
                )}
                {entry.updatedOnLabel !== null && (
                  <p className="text-xs text-text-muted">
                    Updated{" "}
                    <span className="font-mono tabular-nums">
                      {entry.updatedOnLabel}
                    </span>
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

// A lead's review page and export never hold peer feedback (AGENTS.md §1).
export function PeerFeedbackLeftOutNote() {
  return (
    <p className="flex items-center gap-2 text-sm text-text-muted">
      <Lock size={16} aria-hidden="true" />
      Peer feedback is left out of this page and of the export.
    </p>
  );
}
