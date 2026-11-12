import type { TeamRole } from "@/lib/auth/team-access";

// A team member as the peer feedback rules take them (#14).
export interface FeedbackMember {
  userId: string;
  name: string | null;
  githubLogin: string | null;
  role: TeamRole;
}

// One author's saved feedback about one teammate in a sprint.
export interface PeerFeedbackEntry {
  authorId: string;
  recipientId: string;
  text: string;
  updatedAt: Date;
}

export interface PeerFeedbackPair {
  author: FeedbackMember;
  recipient: FeedbackMember;
  // null until the author saves feedback about this teammate.
  feedback: { text: string; updatedAt: Date } | null;
}

// Leads and members give each other feedback; instructors only read it
// (AGENTS.md §1 roles).
function isStudent(member: FeedbackMember): boolean {
  return member.role !== "INSTRUCTOR";
}

// The teammates an author writes feedback about: every other lead or member,
// in team order.
export function listTeammates({
  members,
  authorId,
}: {
  members: FeedbackMember[];
  authorId: string;
}): FeedbackMember[] {
  return members.filter(
    (member) => isStudent(member) && member.userId !== authorId
  );
}

// One pair per author and teammate, authors in team order, with the saved
// feedback or null, as the review page and the instructor's export list them.
// An entry from or about someone no longer on the team isn't listed.
export function pairPeerFeedback({
  members,
  entries,
}: {
  members: FeedbackMember[];
  entries: PeerFeedbackEntry[];
}): PeerFeedbackPair[] {
  return members.filter(isStudent).flatMap((author) =>
    listTeammates({ members, authorId: author.userId }).map((recipient) => {
      const entry = entries.find(
        (candidate) =>
          candidate.authorId === author.userId &&
          candidate.recipientId === recipient.userId
      );
      return {
        author,
        recipient,
        feedback:
          entry === undefined
            ? null
            : { text: entry.text, updatedAt: entry.updatedAt },
      };
    })
  );
}
