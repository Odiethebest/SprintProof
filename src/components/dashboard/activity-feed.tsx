import Link from "next/link";
import {
  Activity,
  Eye,
  GitCommitHorizontal,
  GitPullRequest,
  MessageSquare,
  type LucideIcon,
} from "lucide-react";
import type { ActivityFeedItem } from "@/lib/dashboard/activity-feed";
import type { ReviewState } from "@/lib/github/webhook-events";
import {
  EMPTY_STATE_LINK_CLASSES,
  EmptyState,
} from "@/components/ui/empty-state";

export type ActivityFeedEntryView = ActivityFeedItem & {
  actorName: string;
  timeLabel: string;
};

const KIND_ICONS: Record<ActivityFeedItem["kind"], LucideIcon> = {
  STANDUP: MessageSquare,
  PR_OPENED: GitPullRequest,
  REVIEW: Eye,
  COMMITS: GitCommitHorizontal,
};

// AGENTS.md §2 ActivityFeed: "approved", "requested changes on" or "commented on" #N.
const REVIEW_VERBS: Record<ReviewState, string> = {
  APPROVED: "approved",
  CHANGES_REQUESTED: "requested changes on",
  COMMENTED: "commented on",
};

function prLabel(prNumber: number | null): string {
  return prNumber === null ? "a PR" : `#${prNumber}`;
}

// Reviews stored before #57 have no state, so they keep the plain verb.
function reviewVerb(reviewState: ReviewState | null): string {
  return reviewState === null ? "reviewed" : REVIEW_VERBS[reviewState];
}

// The action after the actor's name, e.g. "pushed 3 commits".
export function describeAction(entry: ActivityFeedEntryView): string {
  switch (entry.kind) {
    case "STANDUP":
      return "posted a standup";
    case "PR_OPENED":
      return `opened ${prLabel(entry.prNumber)}`;
    case "REVIEW":
      return `${reviewVerb(entry.reviewState)} ${prLabel(entry.prNumber)}`;
    case "COMMITS":
      return `pushed ${entry.commitCount} ${entry.commitCount === 1 ? "commit" : "commits"}`;
  }
}

function FeedEntry({ entry }: { entry: ActivityFeedEntryView }) {
  const Icon = KIND_ICONS[entry.kind];
  return (
    <li className="flex gap-3">
      <Icon
        size={16}
        aria-hidden="true"
        className="mt-0.5 shrink-0 text-text-muted"
      />
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-sm">
          <span className="font-medium">{entry.actorName}</span>{" "}
          {describeAction(entry)}
        </p>
        {entry.summary !== null && (
          <p className="truncate text-xs text-text-muted">{entry.summary}</p>
        )}
        <p className="font-mono text-xs text-text-muted">{entry.timeLabel}</p>
      </div>
    </li>
  );
}

// AGENTS.md §2 ActivityFeed: the 20 most recent items in the selected sprint.
export function ActivityFeed({
  sprintName,
  entries,
  postStandupHref,
}: {
  sprintName: string;
  entries: ActivityFeedEntryView[];
  postStandupHref: string | null;
}) {
  return (
    <section
      aria-labelledby="activity-feed-title"
      className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 md:p-6"
    >
      <div className="flex flex-col gap-1">
        <h2 id="activity-feed-title" className="text-lg font-semibold">
          Activity
        </h2>
        <p className="text-xs text-text-muted">
          From GitHub and standups, newest first
        </p>
      </div>
      {entries.length === 0 ? (
        <EmptyState Icon={Activity}>
          <p className="text-sm text-text-muted">
            No activity in {sprintName} yet.
          </p>
          {postStandupHref !== null && (
            <Link href={postStandupHref} className={EMPTY_STATE_LINK_CLASSES}>
              Post today&apos;s standup
            </Link>
          )}
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-4">
          {entries.map((entry) => (
            <FeedEntry key={entry.id} entry={entry} />
          ))}
        </ul>
      )}
    </section>
  );
}
