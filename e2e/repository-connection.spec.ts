import crypto from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { signInAsTestUser, type TestUser } from "./helpers/auth";
import {
  expectNoBlockingViolations,
  joinTeam,
  signedInPage,
} from "./helpers/teams";
import { copyWebhookSecret, deliverWebhook } from "./helpers/webhooks";

// Decision 007 (#117): a team's repository is pending until GitHub delivers a
// ping signed with the team's own webhook secret. Pending claims don't block
// anyone; once a team is verified, nobody else can claim the repository.

// One login per test, so parallel sign-ins never create the same user at once.
const LEAD: TestUser = {
  login: "ziqi-repo-connection-lead-e2e",
  name: "Ziqi (Odie) Yang",
};
const MEMBER: TestUser = {
  login: "yunhong-repo-connection-member-e2e",
  name: "Yunhong Huang",
};
const OTHER_LEAD: TestUser = {
  login: "alex-repo-connection-other-lead-e2e",
  name: "Alex Chen",
};
const LATE_LEAD: TestUser = {
  login: "sam-repo-connection-late-lead-e2e",
  name: "Sam Lee",
};

// A repo no earlier run used, since the local E2E database keeps old teams.
function uniqueRepo() {
  const suffix = `${Date.now()}${String(Math.floor(Math.random() * 1000)).padStart(3, "0")}`;
  return { id: Number(suffix), full_name: `e2e-connect-${suffix}/sprintproof` };
}

function createTeamFor(page: Page, repoFullName: string) {
  return page.request.post("/api/v1/teams", {
    data: { name: "Repository connection team", repoFullName },
  });
}

async function createdTeamId(page: Page, repoFullName: string) {
  const created = await createTeamFor(page, repoFullName);
  expect(created.status()).toBe(201);
  return ((await created.json()) as { id: string }).id;
}

function connectionStatus(page: Page) {
  return page
    .getByRole("region", { name: "Repository" })
    .getByTestId("repository-connection");
}

test.describe("Repository connection", () => {
  test("Settings says it's waiting for GitHub's ping until the ping signed with the team's secret arrives, then Connected", async ({
    page,
    browser,
  }) => {
    // Arrange: the lead creates the team, a member joins, and another
    // team claims the same repository first
    await signInAsTestUser(page, LEAD);
    const repo = uniqueRepo();
    const teamId = await createdTeamId(page, repo.full_name);
    const memberPage = await signedInPage(browser, MEMBER);
    await joinTeam({ lead: page, joiner: memberPage, teamId, role: "MEMBER" });
    const otherPage = await signedInPage(browser, OTHER_LEAD);
    const otherTeamId = await createdTeamId(
      otherPage,
      repo.full_name.toUpperCase()
    );

    // Act
    const secret = await copyWebhookSecret(page, teamId);

    // Assert: pending for the lead and the member alike
    await expect(connectionStatus(page)).toHaveText(
      "Waiting for GitHub's ping"
    );
    await expectNoBlockingViolations(page);
    await memberPage.goto(`/teams/${teamId}/settings`);
    await expect(connectionStatus(memberPage)).toHaveText(
      "Waiting for GitHub's ping"
    );

    // Act: the lead adds the webhook on GitHub, and GitHub pings
    const ping = await deliverWebhook(page.request, {
      secret,
      event: "ping",
      deliveryId: crypto.randomUUID(),
      payload: {
        zen: "Keep it logically awesome.",
        hook_id: 1,
        repository: { ...repo, name: "sprintproof" },
        sender: { login: LEAD.login },
      },
    });

    // Assert: connected, and the ping is the last verified delivery
    expect(ping.status()).toBe(200);
    await page.reload();
    await expect(connectionStatus(page)).toHaveText("Connected");
    await expect(
      page.getByRole("region", { name: "Repository" })
    ).toContainText(/Last delivery\s*ping at .+Verified/);
    await expectNoBlockingViolations(page);
    await memberPage.reload();
    await expect(connectionStatus(memberPage)).toHaveText("Connected");

    // Assert: the team that claimed it first stays pending
    await otherPage.goto(`/teams/${otherTeamId}/settings`);
    await expect(connectionStatus(otherPage)).toHaveText(
      "Waiting for GitHub's ping"
    );

    // Act: someone else tries to claim the connected repository
    const latePage = await signedInPage(browser, LATE_LEAD);
    const late = await createTeamFor(
      latePage,
      repo.full_name.replace("sprintproof", "SprintProof")
    );

    // Assert
    expect(late.status()).toBe(409);
    expect(await late.json()).toEqual({
      error: { code: "REPO_ALREADY_CONNECTED", message: expect.any(String) },
    });
  });
});
