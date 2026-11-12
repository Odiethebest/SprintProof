import crypto from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { signInAsTestUser, type TestUser } from "./helpers/auth";
import { COURSE_STAFF } from "./helpers/course-staff";
import {
  expectNoBlockingViolations,
  joinAsInstructor,
  joinTeam,
  signedInPage,
} from "./helpers/teams";
import {
  copyWebhookSecret,
  deliverWebhook,
  SERVER_WEBHOOK_SECRET,
} from "./helpers/webhooks";

// Decision 005 (#115): each team has its own webhook secret. The lead copies
// it into GitHub from Settings and can rotate it; nobody else sees it.

// One login per test, so parallel sign-ins never create the same user at once.
const ROTATE_LEAD: TestUser = {
  login: "ziqi-webhook-secret-lead-e2e",
  name: "Ziqi (Odie) Yang",
};
const HIDDEN_LEAD: TestUser = {
  login: "ziqi-webhook-secret-hidden-lead-e2e",
  name: "Ziqi (Odie) Yang",
};
const MEMBER: TestUser = {
  login: "yunhong-webhook-secret-member-e2e",
  name: "Yunhong Huang",
};
const INSTRUCTOR: TestUser = {
  login: "priya-webhook-secret-instructor-e2e",
  name: "Priya (TA)",
};

// A repo no earlier run used, since the local E2E database keeps old teams.
function uniqueRepo() {
  const suffix = `${Date.now()}${String(Math.floor(Math.random() * 1000)).padStart(3, "0")}`;
  return { id: Number(suffix), full_name: `e2e-secret-${suffix}/sprintproof` };
}

async function createTeamFor(
  page: Page,
  repo: ReturnType<typeof uniqueRepo>
): Promise<string> {
  const created = await page.request.post("/api/v1/teams", {
    data: { name: "Webhook secret team", repoFullName: repo.full_name },
  });
  expect(created.status()).toBe(201);
  const { id } = (await created.json()) as { id: string };
  return id;
}

function ping(
  page: Page,
  input: { secret: string; repo: ReturnType<typeof uniqueRepo> }
) {
  return deliverWebhook(page.request, {
    secret: input.secret,
    event: "ping",
    deliveryId: crypto.randomUUID(),
    payload: {
      zen: "Keep it logically awesome.",
      hook_id: 1,
      repository: { ...input.repo, name: "sprintproof" },
      sender: { login: ROTATE_LEAD.login },
    },
  });
}

test.describe("Webhook secret", () => {
  test("the lead copies the team's secret for GitHub and rotates it, and the old one stops working", async ({
    page,
  }) => {
    // Arrange
    await signInAsTestUser(page, ROTATE_LEAD);
    const repo = uniqueRepo();
    const teamId = await createTeamFor(page, repo);

    // Act: the lead copies the secret from Settings
    const secret = await copyWebhookSecret(page, teamId);

    // Assert: shown masked, with its last 4 characters
    const card = page.getByRole("region", { name: "Repository" });
    const masked = card.getByTestId("webhook-secret-masked");
    await expect(masked).toHaveText(`••••••••${secret.slice(-4)}`);
    await expect(card).not.toContainText(secret);
    await expect(card.getByRole("status")).toHaveText("Webhook secret copied.");
    await expectNoBlockingViolations(page);

    // Assert: GitHub's deliveries verify with the team's secret, not the server's
    expect((await ping(page, { secret, repo })).status()).toBe(200);
    expect(
      (await ping(page, { secret: SERVER_WEBHOOK_SECRET, repo })).status()
    ).toBe(401);

    // Act: open the confirmation, then cancel it
    const rotate = card.getByRole("button", { name: "Rotate secret" });
    await rotate.click();
    const dialog = page.getByRole("dialog", {
      name: "Rotate the webhook secret?",
    });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(
      "GitHub's deliveries fail until you paste the new secret into the webhook on GitHub."
    );
    await expectNoBlockingViolations(page);
    await dialog.getByRole("button", { name: "Cancel" }).click();

    // Assert: nothing changed, focus back on the trigger
    await expect(dialog).toBeHidden();
    await expect(rotate).toBeFocused();
    await expect(masked).toHaveText(`••••••••${secret.slice(-4)}`);

    // Act: rotate for real
    await rotate.click();
    await dialog.getByRole("button", { name: "Rotate secret" }).click();

    // Assert: a new secret, focus back on the trigger, announced politely
    await expect(dialog).toBeHidden();
    await expect(masked).not.toHaveText(`••••••••${secret.slice(-4)}`);
    await expect(rotate).toBeFocused();
    await expect(card.getByRole("status")).toHaveText(
      "Webhook secret rotated. Paste the new one into GitHub."
    );

    // Assert: the old secret stops working, the new one works
    expect((await ping(page, { secret, repo })).status()).toBe(401);
    const newSecret = await copyWebhookSecret(page, teamId);
    expect(newSecret).not.toBe(secret);
    await expect(masked).toHaveText(`••••••••${newSecret.slice(-4)}`);
    expect((await ping(page, { secret: newSecret, repo })).status()).toBe(200);
  });

  test("members and instructors never see the secret or the rotate control", async ({
    page,
    browser,
  }) => {
    // Arrange: a lead, a member and an instructor on one team
    await signInAsTestUser(page, HIDDEN_LEAD);
    const repo = uniqueRepo();
    const teamId = await createTeamFor(page, repo);
    const secret = await copyWebhookSecret(page, teamId);
    const memberPage = await signedInPage(browser, MEMBER);
    await joinTeam({ lead: page, joiner: memberPage, teamId, role: "MEMBER" });
    const staffPage = await signedInPage(browser, COURSE_STAFF.webhookSecret);
    const instructorPage = await signedInPage(browser, INSTRUCTOR);
    await joinAsInstructor({
      staff: staffPage,
      joiner: instructorPage,
      teamId,
    });

    for (const other of [memberPage, instructorPage]) {
      // Act
      await other.goto(`/teams/${teamId}/settings`);

      // Assert: the repository is shown, the secret isn't, not even in the page source
      const card = other.getByRole("region", { name: "Repository" });
      await expect(card).toContainText(repo.full_name);
      await expect(card).not.toContainText("Webhook secret");
      await expect(
        card.getByRole("button", { name: "Rotate secret" })
      ).toHaveCount(0);
      expect(await other.content()).not.toContain(secret);
      await expectNoBlockingViolations(other);

      // Act: try the endpoint directly
      const rotated = await other.request.post(
        `/api/v1/teams/${teamId}/webhook-secret`
      );

      // Assert
      expect(rotated.status()).toBe(403);
    }
    expect((await ping(page, { secret, repo })).status()).toBe(200);
  });
});
