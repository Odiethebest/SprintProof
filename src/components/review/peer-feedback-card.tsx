import { Lock, MessageSquare } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

// AGENTS.md §2 Review "Peer feedback", for instructors only (PRD R7). Peer
// feedback (#14) isn't built yet, so the card says so.
export function PeerFeedbackCard() {
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
      <EmptyState Icon={MessageSquare}>
        <p className="text-sm text-text-muted">
          Peer feedback isn&apos;t recorded in SprintProof yet.
        </p>
      </EmptyState>
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
