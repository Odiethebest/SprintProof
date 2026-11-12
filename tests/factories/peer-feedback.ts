import type {
  FeedbackMember,
  PeerFeedbackEntry,
} from "@/lib/peer-feedback/peer-feedback-pairs";

let feedbackMemberSeq = 1;

export function resetFeedbackMemberSeq(): void {
  feedbackMemberSeq = 1;
}

// A team member as the peer feedback rules take them (#14).
export function createFeedbackMember(
  overrides: Partial<FeedbackMember> = {}
): FeedbackMember {
  const id = feedbackMemberSeq++;
  return {
    userId: `user-${id}`,
    name: `Member ${id}`,
    githubLogin: `user${id}`,
    role: "MEMBER",
    ...overrides,
  };
}

// One author's saved feedback about one teammate.
export function createPeerFeedbackEntry(
  overrides: Partial<PeerFeedbackEntry> &
    Pick<PeerFeedbackEntry, "authorId" | "recipientId">
): PeerFeedbackEntry {
  return {
    text: "Explains decisions well in PR descriptions.",
    updatedAt: new Date("2026-10-31T17:00:00Z"),
    ...overrides,
  };
}
