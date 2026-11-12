import { z } from "zod";
import { toCommitKey } from "./commit-key";

export type ReviewState = "APPROVED" | "CHANGES_REQUESTED" | "COMMENTED";

export interface MappedActivity {
  type: "COMMIT" | "PR_OPENED" | "PR_MERGED" | "REVIEW";
  actorLogin: string;
  prNumber: number | null;
  prAuthorLogin: string | null;
  sha: string | null;
  title: string | null;
  // Set only on a REVIEW, and null there when GitHub's state is one we don't know.
  reviewState: ReviewState | null;
  // Set only on a COMMIT, from its author, author date and message (#114), and
  // null there when the payload leaves one out: it's then deduplicated by SHA only.
  commitKey: string | null;
  occurredAt: Date;
}

export interface WebhookRepository {
  id: number;
  fullName: string;
}

export type WebhookMapping =
  | { isValid: true; activities: MappedActivity[] }
  | { isValid: false; message: string };

const repositorySchema = z.object({
  repository: z.object({
    id: z.number().int().positive(),
    full_name: z.string().min(1),
  }),
});

// Each schema lists only the fields we store, so GitHub adding fields never breaks a delivery.
const timestampSchema = z.iso.datetime({ offset: true });
const accountSchema = z.object({ login: z.string().min(1) });
const prNumberSchema = z.number().int().positive();
const actionSchema = z.object({ action: z.string() });
// PostgreSQL text can't store NUL. User text is rejected with 400 (noNul), but a
// redelivery carries the same payload, so rejecting this text would drop the
// event for good. Removing NUL keeps the commit or PR counted (#90).
const webhookTextSchema = z
  .string()
  .transform((text) => text.replaceAll("\u0000", ""));

// GitHub leaves out `username` when the email isn't linked to an account.
const usernameSchema = z.string().min(1).nullish();

// `ref`, the default branch, the committer and `distinct` only leave out
// GitHub's own commits, and GitHub always sends them. A push without them maps
// as it did before #114 rather than being rejected, which would drop its commits.
const pushSchema = z.object({
  ref: z.string().nullish(),
  repository: z.object({ default_branch: z.string().nullish() }).nullish(),
  commits: z.array(
    z.object({
      id: z.string().min(1),
      message: webhookTextSchema,
      // The committer date: a rebase or an amend moves it, not the author date.
      timestamp: timestampSchema,
      distinct: z.boolean().nullish(),
      author: z.object({
        name: z.string().nullish(),
        email: z.string().nullish(),
        date: timestampSchema.nullish(),
        username: usernameSchema,
      }),
      committer: z.object({ username: usernameSchema }).nullish(),
    })
  ),
});

type PushPayload = z.infer<typeof pushSchema>;
type PushCommit = PushPayload["commits"][number];

// The account GitHub commits as when it makes a commit itself: merge commits,
// the copies "Rebase and merge" and "Squash and merge" make, web editor edits.
const GITHUB_COMMITTER_LOGIN = "web-flow";

const openedPullRequestSchema = z.object({
  pull_request: z.object({
    number: prNumberSchema,
    title: webhookTextSchema,
    user: accountSchema,
    created_at: timestampSchema,
  }),
});

const closedPullRequestSchema = z.object({
  pull_request: z.object({ merged: z.boolean() }),
});

const mergedPullRequestSchema = z.object({
  pull_request: z.object({
    number: prNumberSchema,
    title: webhookTextSchema,
    user: accountSchema,
    merged_at: timestampSchema,
    merged_by: accountSchema,
  }),
});

// GitHub sends review.state in lowercase in pull_request_review payloads.
const REVIEW_STATES = {
  approved: "APPROVED",
  changes_requested: "CHANGES_REQUESTED",
  commented: "COMMENTED",
} as const satisfies Record<string, ReviewState>;

// Counting rule: a submitted review counts whatever its state (AGENTS.md §1,
// R3), and a redelivery carries the same state, so rejecting an unknown or
// missing one would drop a counted review for good. It's stored as null
// instead, and the feed says "reviewed #N" (#57).
const reviewStateSchema = z
  .enum(["approved", "changes_requested", "commented"])
  .transform((state) => REVIEW_STATES[state])
  .nullable()
  .catch(null);

const submittedReviewSchema = z.object({
  review: z.object({
    user: accountSchema,
    state: reviewStateSchema,
    submitted_at: timestampSchema,
  }),
  pull_request: z.object({
    number: prNumberSchema,
    title: webhookTextSchema,
    user: accountSchema,
  }),
});

function isBot(login: string): boolean {
  return login.toLowerCase().endsWith("[bot]");
}

function valid(activities: MappedActivity[]): WebhookMapping {
  return { isValid: true, activities };
}

function invalid(event: string): WebhookMapping {
  return {
    isValid: false,
    message: `This ${event} payload isn't in the format GitHub sends.`,
  };
}

export function extractWebhookRepository({
  payload,
}: {
  payload: unknown;
}): WebhookRepository | null {
  const result = repositorySchema.safeParse(payload);
  if (!result.success) {
    return null;
  }
  return {
    id: result.data.repository.id,
    fullName: result.data.repository.full_name,
  };
}

function toCommitTitle(message: string): string | null {
  const [firstLine] = message.split("\n");
  return firstLine === "" ? null : firstLine;
}

function isPushToDefaultBranch(push: PushPayload): boolean {
  const defaultBranch = push.repository?.default_branch;
  return Boolean(defaultBranch) && push.ref === `refs/heads/${defaultBranch}`;
}

// Counting rule: commits GitHub makes on the default branch don't count
// (AGENTS.md §1, decision 004); the PR's own commits counted from its branch.
// Such a commit reaches other branches too (`git merge main`), but only with
// `distinct: false`, which GitHub sets on a commit an earlier push carried. A
// first push decides: one GitHub made on a feature branch ("Update branch")
// was stored then, and a later push of it is a duplicate by SHA anyway.
function isGithubCommitOnDefaultBranch({
  commit,
  isDefaultBranchPush,
}: {
  commit: PushCommit;
  isDefaultBranchPush: boolean;
}): boolean {
  const committer = commit.committer?.username?.toLowerCase();
  if (committer !== GITHUB_COMMITTER_LOGIN) {
    return false;
  }
  return isDefaultBranchPush || commit.distinct === false;
}

function toPushCommitKey(commit: PushCommit): string | null {
  const { name, email, date } = commit.author;
  if (!name || !email || !date) {
    return null;
  }
  return toCommitKey({
    authorName: name,
    authorEmail: email,
    authorDate: new Date(date),
    message: commit.message,
  });
}

function mapPush({ payload }: { payload: unknown }): WebhookMapping {
  const parsed = pushSchema.safeParse(payload);
  if (!parsed.success) {
    return invalid("push");
  }

  const isDefaultBranchPush = isPushToDefaultBranch(parsed.data);
  const activities = parsed.data.commits.flatMap((commit): MappedActivity[] => {
    const authorLogin = commit.author.username;
    // Counting rule: commits count for their author's GitHub login, never for the
    // committer or the pusher, and bots never count (AGENTS.md §1).
    if (!authorLogin || isBot(authorLogin)) {
      return [];
    }
    if (isGithubCommitOnDefaultBranch({ commit, isDefaultBranchPush })) {
      return [];
    }
    return [
      {
        type: "COMMIT",
        actorLogin: authorLogin,
        prNumber: null,
        prAuthorLogin: null,
        sha: commit.id,
        title: toCommitTitle(commit.message),
        reviewState: null,
        commitKey: toPushCommitKey(commit),
        occurredAt: new Date(commit.timestamp),
      },
    ];
  });
  return valid(activities);
}

function mapOpenedPullRequest({
  payload,
}: {
  payload: unknown;
}): WebhookMapping {
  const parsed = openedPullRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return invalid("pull_request");
  }

  const pr = parsed.data.pull_request;
  if (isBot(pr.user.login)) {
    return valid([]);
  }
  return valid([
    {
      type: "PR_OPENED",
      actorLogin: pr.user.login,
      prNumber: pr.number,
      prAuthorLogin: pr.user.login,
      sha: null,
      title: pr.title,
      reviewState: null,
      commitKey: null,
      occurredAt: new Date(pr.created_at),
    },
  ]);
}

function mapClosedPullRequest({
  payload,
}: {
  payload: unknown;
}): WebhookMapping {
  const closed = closedPullRequestSchema.safeParse(payload);
  if (!closed.success) {
    return invalid("pull_request");
  }
  if (!closed.data.pull_request.merged) {
    return valid([]);
  }

  const parsed = mergedPullRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return invalid("pull_request");
  }

  const pr = parsed.data.pull_request;
  if (isBot(pr.merged_by.login)) {
    return valid([]);
  }
  return valid([
    {
      type: "PR_MERGED",
      actorLogin: pr.merged_by.login,
      prNumber: pr.number,
      prAuthorLogin: pr.user.login,
      sha: null,
      title: pr.title,
      reviewState: null,
      commitKey: null,
      occurredAt: new Date(pr.merged_at),
    },
  ]);
}

function mapPullRequest({ payload }: { payload: unknown }): WebhookMapping {
  const parsed = actionSchema.safeParse(payload);
  if (!parsed.success) {
    return invalid("pull_request");
  }

  switch (parsed.data.action) {
    case "opened":
      return mapOpenedPullRequest({ payload });
    case "closed":
      return mapClosedPullRequest({ payload });
    default:
      return valid([]);
  }
}

function mapReview({ payload }: { payload: unknown }): WebhookMapping {
  const action = actionSchema.safeParse(payload);
  if (!action.success) {
    return invalid("pull_request_review");
  }
  if (action.data.action !== "submitted") {
    return valid([]);
  }

  const parsed = submittedReviewSchema.safeParse(payload);
  if (!parsed.success) {
    return invalid("pull_request_review");
  }

  const { review, pull_request: pr } = parsed.data;
  if (isBot(review.user.login)) {
    return valid([]);
  }
  return valid([
    {
      type: "REVIEW",
      actorLogin: review.user.login,
      prNumber: pr.number,
      prAuthorLogin: pr.user.login,
      sha: null,
      title: pr.title,
      reviewState: review.state,
      commitKey: null,
      occurredAt: new Date(review.submitted_at),
    },
  ]);
}

export function mapWebhookToActivities({
  event,
  payload,
}: {
  event: string;
  payload: unknown;
}): WebhookMapping {
  switch (event) {
    case "push":
      return mapPush({ payload });
    case "pull_request":
      return mapPullRequest({ payload });
    case "pull_request_review":
      return mapReview({ payload });
    default:
      return valid([]);
  }
}
