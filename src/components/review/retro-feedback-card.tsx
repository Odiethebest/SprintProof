import { ClipboardList } from "lucide-react";
import type { ExportAudience } from "@/lib/export/sprint-summary-markdown";
import { EmptyState } from "@/components/ui/empty-state";

// Retros (#13) and peer feedback (#14) aren't built yet, so the review page
// says so instead of showing empty cards. A lead's page and export never hold
// peer feedback (AGENTS.md §1, PRD R7).
export function RetroFeedbackCard({ audience }: { audience: ExportAudience }) {
  return (
    <section
      aria-labelledby="review-retro-title"
      className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 md:p-6"
    >
      <h2 id="review-retro-title" className="text-lg font-semibold">
        Retro and peer feedback
      </h2>
      <EmptyState Icon={ClipboardList}>
        <p className="text-sm text-text-muted">
          Retro items, action items and peer feedback aren&apos;t recorded in
          SprintProof yet.
        </p>
        {audience === "TEAM" && (
          <p className="text-sm text-text-muted">
            Peer feedback is left out of this page and of the export.
          </p>
        )}
      </EmptyState>
    </section>
  );
}
