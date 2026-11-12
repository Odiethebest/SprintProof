import { Lock, MessageSquare } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { SavedOnLabel } from "./saved-on-label";
import {
  TeammateFeedbackField,
  type TeammateFeedbackView,
} from "./teammate-feedback-field";

const TITLE_ID = "partner-feedback-title";

// After closing, the retro's partner feedback is read-only (AGENTS.md §2).
function SavedFeedback({ teammate }: { teammate: TeammateFeedbackView }) {
  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-sm font-medium">Feedback for {teammate.name}</h3>
      {teammate.savedText === null ? (
        <p className="text-sm text-text-muted">No feedback saved.</p>
      ) : (
        <p className="whitespace-pre-wrap break-words text-sm">
          {teammate.savedText}
        </p>
      )}
      {teammate.savedOnLabel !== null && (
        <p className="text-xs text-text-muted">
          <SavedOnLabel label={teammate.savedOnLabel} />
        </p>
      )}
    </div>
  );
}

// AGENTS.md §2 PeerFeedbackForm: "Partner feedback" below the retro columns,
// one field per teammate while the retro is open. It holds only what the
// viewer wrote (rule R7); instructors read feedback on the review page.
export function PeerFeedbackForm({
  teamId,
  sprintId,
  isClosed,
  teammates,
}: {
  teamId: string;
  sprintId: string;
  isClosed: boolean;
  teammates: TeammateFeedbackView[];
}) {
  return (
    <section
      aria-labelledby={TITLE_ID}
      className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 md:p-6"
    >
      <div className="flex flex-col gap-1">
        <h2 id={TITLE_ID} className="text-lg font-semibold">
          Partner feedback
        </h2>
        <p className="flex items-center gap-1 text-xs text-text-muted">
          <Lock size={12} aria-hidden="true" />
          {isClosed
            ? "Visible to instructors only. The retro is closed, so it can't be edited."
            : "Visible to instructors only. You can edit it until the retro closes."}
        </p>
      </div>
      {teammates.length === 0 ? (
        <EmptyState Icon={MessageSquare}>
          <p className="text-sm text-text-muted">
            Partner feedback opens once a teammate joins the team.
          </p>
        </EmptyState>
      ) : (
        teammates.map((teammate) =>
          isClosed ? (
            <SavedFeedback key={teammate.userId} teammate={teammate} />
          ) : (
            <TeammateFeedbackField
              key={teammate.userId}
              teamId={teamId}
              sprintId={sprintId}
              teammate={teammate}
            />
          )
        )
      )}
    </section>
  );
}
