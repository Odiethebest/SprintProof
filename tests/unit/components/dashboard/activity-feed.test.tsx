import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReviewState } from "@/lib/github/webhook-events";
import {
  ActivityFeed,
  describeAction,
  type ActivityFeedEntryView,
} from "@/components/dashboard/activity-feed";
import { buildLiveUpdates } from "@/components/dashboard/live-updates";
import type { MemberCardView } from "@/components/dashboard/member-card";

function reviewEntry(input: {
  reviewState: ReviewState | null;
  prNumber?: number | null;
}): ActivityFeedEntryView {
  return {
    kind: "REVIEW",
    id: "activity-review",
    userId: "user-2",
    prNumber: input.prNumber === undefined ? 105 : input.prNumber,
    reviewState: input.reviewState,
    summary: "Show live contribution dashboard",
    occurredAt: new Date("2026-11-03T22:41:00Z"),
    actorName: "Yunhong Huang",
    timeLabel: "Nov 3, 2:41 PM",
  };
}

// The text of each feed row's first line: the actor's name and the action.
function feedActions(html: string): string[] {
  return [
    ...html.matchAll(
      /<p class="text-sm"><span class="font-medium">([^<]*)<\/span> ([^<]*)<\/p>/g
    ),
  ].map(([, actor, action]) => `${actor} ${action}`);
}

// AGENTS.md §2 ActivityFeed: reviews say "approved", "requested changes on"
// or "commented on" #N. Reviews stored before #57 have no state.
describe("describeAction for a review", () => {
  it.each([
    ["APPROVED", "approved #105"],
    ["CHANGES_REQUESTED", "requested changes on #105"],
    ["COMMENTED", "commented on #105"],
    [null, "reviewed #105"],
  ] as const)("describes a %s review as %s", (reviewState, action) => {
    expect(describeAction(reviewEntry({ reviewState }))).toBe(action);
  });

  it("says a PR when the review has no PR number", () => {
    expect(
      describeAction(reviewEntry({ reviewState: "APPROVED", prNumber: null }))
    ).toBe("approved a PR");
  });
});

describe("ActivityFeed", () => {
  it("shows each review with what the reviewer did", () => {
    // Arrange
    const entries: ActivityFeedEntryView[] = [
      { ...reviewEntry({ reviewState: "APPROVED" }), id: "r1", prNumber: 113 },
      {
        ...reviewEntry({ reviewState: "CHANGES_REQUESTED" }),
        id: "r2",
        prNumber: 106,
      },
      { ...reviewEntry({ reviewState: "COMMENTED" }), id: "r3", prNumber: 111 },
      { ...reviewEntry({ reviewState: null }), id: "r4", prNumber: 104 },
    ];

    // Act
    const html = renderToStaticMarkup(
      <ActivityFeed
        sprintName="Sprint 1"
        entries={entries}
        postStandupHref={null}
      />
    );

    // Assert
    expect(feedActions(html)).toEqual([
      "Yunhong Huang approved #113",
      "Yunhong Huang requested changes on #106",
      "Yunhong Huang commented on #111",
      "Yunhong Huang reviewed #104",
    ]);
  });
});

describe("buildLiveUpdates for a review", () => {
  const card: MemberCardView = {
    userId: "user-2",
    name: "Yunhong Huang",
    githubLogin: "santiaojun",
    role: "MEMBER",
    isViewer: false,
    commits: 0,
    pullRequests: 0,
    standups: { count: 1, required: 3, remaining: 2, status: "ON_TRACK" },
    reviews: { count: 3, required: 5, remaining: 2, status: "AT_RISK" },
  };

  it.each([
    ["APPROVED", "Yunhong Huang approved #105. PR reviews 3 of 5, at risk."],
    [
      "CHANGES_REQUESTED",
      "Yunhong Huang requested changes on #105. PR reviews 3 of 5, at risk.",
    ],
    [
      "COMMENTED",
      "Yunhong Huang commented on #105. PR reviews 3 of 5, at risk.",
    ],
    [null, "Yunhong Huang reviewed #105. PR reviews 3 of 5, at risk."],
  ] as const)("announces a %s review as %j", (reviewState, message) => {
    const [update] = buildLiveUpdates({
      entries: [reviewEntry({ reviewState })],
      cards: [card],
    });

    expect(update.message).toBe(message);
  });
});
