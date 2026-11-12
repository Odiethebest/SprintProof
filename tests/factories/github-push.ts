// Push payloads in the shape GitHub delivers them, checked against real
// deliveries to our repository's webhook (#114): `timestamp` is the committer
// date, the author's own date is `author.date`, `distinct` is false for a
// commit an earlier push already carried, and GitHub's own commits have the
// committer `web-flow`.

export interface PushPersonFixture {
  name: string;
  email: string;
  date: string;
  username?: string;
}

export interface PushCommitFixture {
  id: string;
  distinct: boolean;
  message: string;
  timestamp: string;
  author: PushPersonFixture;
  committer: PushPersonFixture;
}

const ALICE: PushPersonFixture = {
  name: "Alice Smith",
  email: "alice@example.com",
  date: "2026-11-02T18:00:00Z",
  username: "alice",
};

// Alice's commit, pushed for the first time on Nov 2, 10:00 AM in Los Angeles.
export function createPushCommit(
  overrides: Partial<PushCommitFixture> = {}
): PushCommitFixture {
  return {
    id: "1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b",
    distinct: true,
    message: "feat: add the dashboard page\n\nShows each member's counts.",
    timestamp: ALICE.date,
    author: ALICE,
    committer: ALICE,
    ...overrides,
  };
}

// What a local rebase, an amend that keeps the message, or a force-push leaves:
// the same author, author date and message under a new SHA and committer date.
export function createRebasedCopy(
  commit: PushCommitFixture,
  { id, committedAt }: { id: string; committedAt: string }
): PushCommitFixture {
  return {
    ...commit,
    id,
    distinct: true,
    timestamp: committedAt,
    committer: { ...commit.committer, date: committedAt },
  };
}

// A commit GitHub makes itself, such as the merge commit of "Create a merge
// commit": authored by whoever clicked merge, committed by `web-flow`.
export function createGithubCommit(
  overrides: Partial<PushCommitFixture> = {}
): PushCommitFixture {
  const madeAt = "2026-11-02T19:00:00Z";
  return {
    id: "9f8e7d6c5b4a39281706f5e4d3c2b1a098765432",
    distinct: true,
    message:
      "Merge pull request #12 from Odiethebest/feature/12-dashboard\n\nfeat: add the dashboard page",
    timestamp: madeAt,
    author: { ...ALICE, date: madeAt },
    committer: {
      name: "GitHub",
      email: "noreply@github.com",
      date: madeAt,
      username: "web-flow",
    },
    ...overrides,
  };
}

export function createPushPayload({
  ref,
  defaultBranch = "main",
  commits,
}: {
  ref: string;
  defaultBranch?: string;
  // Any commit object, so a test can leave out a field GitHub sends.
  commits: object[];
}) {
  return {
    ref,
    repository: {
      id: 987654321,
      name: "SprintProof",
      full_name: "Odiethebest/SprintProof",
      default_branch: defaultBranch,
    },
    pusher: { name: "alice" },
    sender: { login: "alice" },
    commits,
  };
}
