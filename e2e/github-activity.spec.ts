import crypto from "node:crypto";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { signInAsTestUser, type TestUser } from "./helpers/auth";
import {
  addSprint,
  expectNoBlockingViolations,
  joinTeam,
  signedInPage,
} from "./helpers/teams";
import { copyWebhookSecret, deliverWebhook } from "./helpers/webhooks";

// AGENTS.md §2 User flows, flow 3: a review or a push on GitHub reaches
// /api/webhooks/github, is verified and stored, and a teammate's open
// dashboard shows it within seconds. Needs Soketi, like live-dashboard.spec.ts.

// One login per test, so parallel sign-ins never create the same user at once.
const REVIEW_LEAD: TestUser = {
  login: "ziqi-github-review-lead-e2e",
  name: "Ziqi (Odie) Yang",
};
const REVIEWER: TestUser = {
  login: "yunhong-github-reviewer-e2e",
  name: "Yunhong Huang",
};
const PUSH_LEAD: TestUser = {
  login: "ziqi-github-push-lead-e2e",
  name: "Ziqi (Odie) Yang",
};
const PUSHER: TestUser = {
  login: "yunhong-github-pusher-e2e",
  name: "Yunhong Huang",
};

interface GithubRepo {
  id: number;
  fullName: string;
}

// A repo no earlier run used: a delivery finds its team by repo id first, and
// the local E2E database keeps the teams of earlier runs.
function uniqueRepo(): GithubRepo {
  const suffix = `${Date.now()}${String(Math.floor(Math.random() * 1000)).padStart(3, "0")}`;
  return { id: Number(suffix), fullName: `e2e-gh-${suffix}/sprintproof` };
}

// The lead creates the team and Sprint 1, and the member joins. The team is
// created through the API, so the test knows the repo its deliveries name.
// GitHub signs them with the team's own secret, which the lead copies from
// Settings (#115). Adding the webhook makes GitHub send a ping, which
// connects the repository (decision 007, #117).
async function setUpTeam(
  page: Page,
  browser: Browser,
  { lead, member }: { lead: TestUser; member: TestUser }
): Promise<{ teamId: string; repo: GithubRepo; secret: string }> {
  await signInAsTestUser(page, lead);
  const repo = uniqueRepo();
  const created = await page.request.post("/api/v1/teams", {
    data: { name: "GitHub activity team", repoFullName: repo.fullName },
  });
  expect(created.status()).toBe(201);
  const { id: teamId } = (await created.json()) as { id: string };
  await addSprint(page, {
    teamId,
    name: "Sprint 1",
    startOffset: -3,
    endOffset: 3,
  });
  const memberPage = await signedInPage(browser, member);
  await joinTeam({ lead: page, joiner: memberPage, teamId, role: "MEMBER" });
  const secret = await copyWebhookSecret(page, teamId);
  const ping = await deliverWebhook(page.request, {
    secret,
    event: "ping",
    deliveryId: crypto.randomUUID(),
    payload: {
      zen: "Keep it logically awesome.",
      hook_id: 1,
      repository: repositoryField(repo),
      sender: { login: lead.login },
    },
  });
  expect(ping.status()).toBe(200);
  return { teamId, repo, secret };
}

async function openLiveDashboard(page: Page, teamId: string): Promise<void> {
  await page.goto(`/teams/${teamId}/dashboard`);
  await expect(page.getByText("Live", { exact: true })).toBeVisible({
    timeout: 10_000,
  });
  // A full page load would drop this marker.
  await page.evaluate(() => Object.assign(window, { noReload: true }));
}

function repositoryField(repo: GithubRepo) {
  return { id: repo.id, name: "sprintproof", full_name: repo.fullName };
}

// A commit as a push payload lists it, a few seconds old, so two commits never
// fall on different days.
function pushedCommit(input: {
  author: TestUser;
  message: string;
  secondsAgo: number;
}) {
  return {
    id: crypto.randomBytes(20).toString("hex"),
    message: input.message,
    timestamp: new Date(Date.now() - input.secondsAgo * 1000).toISOString(),
    author: {
      name: input.author.name,
      email: `${input.author.login}@example.com`,
      username: input.author.login,
    },
  };
}

test.describe("GitHub activity", () => {
  test("a review on GitHub updates a teammate's open dashboard without a reload, and Settings shows the verified delivery", async ({
    page,
    browser,
    request,
  }) => {
    // Arrange: the lead watches the dashboard
    const { teamId, repo, secret } = await setUpTeam(page, browser, {
      lead: REVIEW_LEAD,
      member: REVIEWER,
    });
    await openLiveDashboard(page, teamId);
    const reviewerCard = page.getByRole("article", { name: REVIEWER.name });
    await expect(reviewerCard.locator("dl")).toHaveText(
      /Commits\s*0\s*PRs\s*0\s*Reviews\s*0\s*Standups\s*0/
    );

    // Act: the member reviews the lead's PR, and GitHub delivers the review
    const response = await deliverWebhook(request, {
      secret,
      event: "pull_request_review",
      deliveryId: crypto.randomUUID(),
      payload: {
        action: "submitted",
        review: {
          id: 1001,
          user: { login: REVIEWER.login },
          state: "approved",
          submitted_at: new Date().toISOString(),
        },
        pull_request: {
          number: 105,
          title: "Show live contribution dashboard",
          user: { login: REVIEW_LEAD.login },
        },
        repository: repositoryField(repo),
        sender: { login: REVIEWER.login },
      },
    });

    // Assert: within 5 seconds, without a reload, and the changed count gets
    // the highlight, which lasts 1 s (DESIGN.md §8), so poll often
    expect(response.status()).toBe(200);
    const reviewsCount = reviewerCard
      .locator("dl > div", { hasText: "Reviews" })
      .locator("dd > span");
    await expect
      .poll(() => reviewsCount.getAttribute("class"), {
        intervals: [50],
        timeout: 5_000,
      })
      .toContain("bg-primary/10");
    await expect(reviewerCard.locator("dl")).toHaveText(
      /Commits\s*0\s*PRs\s*0\s*Reviews\s*1\s*Standups\s*0/
    );
    await expect(
      reviewerCard.getByRole("listitem").filter({ hasText: "PR reviews" })
    ).toContainText("1 of 5");
    const latest = page
      .getByRole("region", { name: "Activity" })
      .getByRole("listitem")
      .first();
    await expect(latest).toContainText("Yunhong Huang approved #105");
    await expect(latest).toContainText("Show live contribution dashboard");
    await expect(page.getByRole("status")).toHaveText(
      "Yunhong Huang approved #105. PR reviews 1 of 5, on track."
    );
    expect(await page.evaluate(() => "noReload" in window)).toBe(true);
    await expectNoBlockingViolations(page);

    // Act: the member requests changes on another of the lead's PRs
    const changesRequested = await deliverWebhook(request, {
      secret,
      event: "pull_request_review",
      deliveryId: crypto.randomUUID(),
      payload: {
        action: "submitted",
        review: {
          id: 1002,
          user: { login: REVIEWER.login },
          state: "changes_requested",
          submitted_at: new Date().toISOString(),
        },
        pull_request: {
          number: 106,
          title: "Add UI mockups and DESIGN.md",
          user: { login: REVIEW_LEAD.login },
        },
        repository: repositoryField(repo),
        sender: { login: REVIEWER.login },
      },
    });

    // Assert: it counts like the approval (rule R3), and the feed says what it was
    expect(changesRequested.status()).toBe(200);
    await expect(reviewerCard.locator("dl")).toHaveText(
      /Commits\s*0\s*PRs\s*0\s*Reviews\s*2\s*Standups\s*0/,
      { timeout: 5_000 }
    );
    await expect(latest).toContainText(
      "Yunhong Huang requested changes on #106"
    );
    await expect(page.getByRole("status")).toHaveText(
      "Yunhong Huang requested changes on #106. PR reviews 2 of 5, on track."
    );
    expect(await page.evaluate(() => "noReload" in window)).toBe(true);

    // Act: the lead checks the webhook in Settings
    await page.goto(`/teams/${teamId}/settings`);

    // Assert
    await expect(
      page.getByRole("region", { name: "Repository" })
    ).toContainText(/Last delivery\s*pull_request_review at .+Verified/);
  });

  test("a push on GitHub counts each commit once on a teammate's open dashboard, even when it's redelivered", async ({
    page,
    browser,
    request,
  }) => {
    // Arrange: the lead watches the dashboard
    const { teamId, repo, secret } = await setUpTeam(page, browser, {
      lead: PUSH_LEAD,
      member: PUSHER,
    });
    await openLiveDashboard(page, teamId);
    const pusherCard = page.getByRole("article", { name: PUSHER.name });
    await expect(pusherCard.locator("dl")).toHaveText(/Commits\s*0\s*PRs\s*0/);
    const delivery = {
      event: "push",
      deliveryId: crypto.randomUUID(),
      payload: {
        ref: "refs/heads/test/43-github-activity-e2e",
        repository: repositoryField(repo),
        pusher: { name: PUSHER.login },
        sender: { login: PUSHER.login },
        commits: [
          pushedCommit({
            author: PUSHER,
            message: "Add the GitHub activity spec",
            secondsAgo: 2,
          }),
          pushedCommit({
            author: PUSHER,
            message: "Sign the deliveries\n\nWith node:crypto, like GitHub.",
            secondsAgo: 1,
          }),
        ],
      },
    };

    // Act: the member pushes two commits, and GitHub delivers the push
    const response = await deliverWebhook(request, { secret, ...delivery });

    // Assert: within 5 seconds, without a reload
    expect(response.status()).toBe(200);
    await expect(pusherCard.locator("dl")).toHaveText(/Commits\s*2\s*PRs\s*0/, {
      timeout: 5_000,
    });
    const latest = page
      .getByRole("region", { name: "Activity" })
      .getByRole("listitem")
      .first();
    await expect(latest).toContainText("Yunhong Huang pushed 2 commits");
    await expect(latest).toContainText("Sign the deliveries");
    await expect(page.getByRole("status")).toHaveText(
      "Yunhong Huang pushed 2 commits."
    );
    expect(await page.evaluate(() => "noReload" in window)).toBe(true);
    await expectNoBlockingViolations(page);

    // Act: the lead redelivers it from the webhook's Recent Deliveries
    const redelivered = await deliverWebhook(request, { secret, ...delivery });

    // Assert: stored once, so the count stays the same after a reload
    expect(redelivered.status()).toBe(200);
    await page.reload();
    await expect(pusherCard.locator("dl")).toHaveText(/Commits\s*2\s*PRs\s*0/);
  });
});
