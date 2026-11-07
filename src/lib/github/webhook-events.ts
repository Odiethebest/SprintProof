import { z } from "zod";

export interface MappedActivity {
  type: "COMMIT" | "PR_OPENED" | "PR_MERGED" | "REVIEW";
  actorLogin: string;
  prNumber: number | null;
  prAuthorLogin: string | null;
  sha: string | null;
  title: string | null;
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

const pushSchema = z.object({
  commits: z.array(
    z.object({
      id: z.string().min(1),
      message: z.string(),
      timestamp: timestampSchema,
      // GitHub leaves out `username` when the author's email isn't linked to an account.
      author: z.object({ username: z.string().min(1).nullish() }),
    })
  ),
});

const openedPullRequestSchema = z.object({
  pull_request: z.object({
    number: prNumberSchema,
    title: z.string(),
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
    title: z.string(),
    user: accountSchema,
    merged_at: timestampSchema,
    merged_by: accountSchema,
  }),
});

const submittedReviewSchema = z.object({
  review: z.object({
    user: accountSchema,
    submitted_at: timestampSchema,
  }),
  pull_request: z.object({
    number: prNumberSchema,
    title: z.string(),
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

function mapPush({ payload }: { payload: unknown }): WebhookMapping {
  const parsed = pushSchema.safeParse(payload);
  if (!parsed.success) {
    return invalid("push");
  }

  const activities = parsed.data.commits.flatMap((commit): MappedActivity[] => {
    const authorLogin = commit.author.username;
    // Counting rule: commits count for their author's GitHub login, never for the
    // committer or the pusher, and bots never count (AGENTS.md §1).
    if (!authorLogin || isBot(authorLogin)) {
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
