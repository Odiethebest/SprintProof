// "Saved Nov 3", or "Not saved yet" before the first save (AGENTS.md §2
// PeerFeedbackForm). The date is a label already formatted in the team's
// timezone.
export function SavedOnLabel({ label }: { label: string | null }) {
  if (label === null) {
    return <>Not saved yet</>;
  }
  return (
    <>
      Saved <span className="font-mono tabular-nums">{label}</span>
    </>
  );
}
