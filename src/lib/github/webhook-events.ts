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

const repositorySchema = z.object({
  repository: z.object({
    id: z.number().int().positive(),
    full_name: z.string().min(1),
  }),
});

function isBot(login: string): boolean {
  return login.toLowerCase().endsWith("[bot]");
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

interface CommitPayload {
  id: string;
  message?: string | null;
  timestamp: string;
  author?: { username?: string | null; name?: string | null } | null;
  committer?: { username?: string | null; name?: string | null } | null;
}

interface PushWebhookPayload {
  commits?: CommitPayload[];
  sender?: { login?: string | null } | null;
}

interface PullRequestWebhookPayload {
  action: string;
  number?: number;
  pull_request?: {
    number: number;
    title?: string | null;
    user?: { login: string } | null;
    created_at: string;
    merged?: boolean | null;
    merged_at?: string | null;
    updated_at?: string | null;
    merged_by?: { login: string } | null;
  } | null;
  sender?: { login?: string | null } | null;
}

interface ReviewWebhookPayload {
  action: string;
  review?: {
    id: number;
    user?: { login: string } | null;
    submitted_at: string;
  } | null;
  pull_request?: {
    number: number;
    title?: string | null;
    user?: { login: string } | null;
  } | null;
}

function mapPushPayload({
  payload,
}: {
  payload: PushWebhookPayload;
}): MappedActivity[] {
  if (!Array.isArray(payload.commits)) {
    return [];
  }

  const activities: MappedActivity[] = [];
  for (const commit of payload.commits) {
    const actorLogin =
      commit.author?.username ||
      commit.committer?.username ||
      payload.sender?.login ||
      null;

    if (!actorLogin || isBot(actorLogin)) {
      continue;
    }

    const firstLineMessage = commit.message
      ? commit.message.split("\n")[0]
      : null;

    activities.push({
      type: "COMMIT",
      actorLogin,
      prNumber: null,
      prAuthorLogin: null,
      sha: commit.id,
      title: firstLineMessage,
      occurredAt: new Date(commit.timestamp),
    });
  }

  return activities;
}

function mapPullRequestPayload({
  payload,
}: {
  payload: PullRequestWebhookPayload;
}): MappedActivity[] {
  const pr = payload.pull_request;
  if (!pr) {
    return [];
  }

  if (payload.action === "opened") {
    const authorLogin = pr.user?.login;
    if (!authorLogin || isBot(authorLogin)) {
      return [];
    }

    return [
      {
        type: "PR_OPENED",
        actorLogin: authorLogin,
        prNumber: pr.number,
        prAuthorLogin: authorLogin,
        sha: null,
        title: pr.title ?? null,
        occurredAt: new Date(pr.created_at),
      },
    ];
  }

  if (payload.action === "closed" && pr.merged === true) {
    const actorLogin = pr.merged_by?.login || payload.sender?.login;
    if (!actorLogin || isBot(actorLogin)) {
      return [];
    }

    const occurredAtString = pr.merged_at || pr.updated_at || pr.created_at;

    return [
      {
        type: "PR_MERGED",
        actorLogin,
        prNumber: pr.number,
        prAuthorLogin: pr.user?.login ?? null,
        sha: null,
        title: pr.title ?? null,
        occurredAt: new Date(occurredAtString),
      },
    ];
  }

  return [];
}

function mapReviewPayload({
  payload,
}: {
  payload: ReviewWebhookPayload;
}): MappedActivity[] {
  if (payload.action !== "submitted" || !payload.review || !payload.pull_request) {
    return [];
  }

  const reviewerLogin = payload.review.user?.login;
  if (!reviewerLogin || isBot(reviewerLogin)) {
    return [];
  }

  return [
    {
      type: "REVIEW",
      actorLogin: reviewerLogin,
      prNumber: payload.pull_request.number,
      prAuthorLogin: payload.pull_request.user?.login ?? null,
      sha: null,
      title: payload.pull_request.title ?? null,
      occurredAt: new Date(payload.review.submitted_at),
    },
  ];
}

export function mapWebhookToActivities({
  event,
  payload,
}: {
  event: string;
  payload: unknown;
}): MappedActivity[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  switch (event) {
    case "push":
      return mapPushPayload({ payload: payload as PushWebhookPayload });
    case "pull_request":
      return mapPullRequestPayload({
        payload: payload as PullRequestWebhookPayload,
      });
    case "pull_request_review":
      return mapReviewPayload({ payload: payload as ReviewWebhookPayload });
    default:
      return [];
  }
}
