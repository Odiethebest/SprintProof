import crypto from "node:crypto";
import { expect, test, type Browser, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { signInAsTestUser, type TestUser } from "./helpers/auth";
import { COURSE_STAFF } from "./helpers/course-staff";
import { isoDate } from "./helpers/teams";
import { copyWebhookSecret, deliverWebhook } from "./helpers/webhooks";

// Needs the dev server started with E2E_TEST_AUTH=true, AUTH_SECRET and DATABASE_URL.
// Data stays in the database between runs, so every team gets its own repo.
const LEAD: TestUser = { login: "ziqi-e2e", name: "Ziqi (Odie) Yang" };
const PARTNER: TestUser = { login: "yunhong-e2e", name: "Yunhong Huang" };
// The journey's own logins, so parallel sign-ins never create the same user
// at once.
const JOURNEY_LEAD: TestUser = {
  login: "ziqi-onboarding-journey-lead-e2e",
  name: "Ziqi (Odie) Yang",
};
const JOURNEY_PARTNER: TestUser = {
  login: "yunhong-onboarding-journey-partner-e2e",
  name: "Yunhong Huang",
};
const INSTRUCTOR_LEAD: TestUser = {
  login: "ziqi-onboarding-instructor-lead-e2e",
  name: "Ziqi (Odie) Yang",
};
const INSTRUCTOR: TestUser = { login: "ta-onboarding-e2e", name: "Course TA" };

const COURSE_STAFF_NOTE = "Instructor invite links come from course staff.";

function uniqueRepo(): string {
  return `e2e-${Date.now()}-${Math.floor(Math.random() * 1000)}/sprintproof`;
}

async function expectNoBlockingViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  const blocking = results.violations.filter(
    (violation) =>
      violation.impact === "serious" || violation.impact === "critical"
  );
  expect(blocking).toEqual([]);
}

// Returns the new team's id.
async function createTeam(page: Page, name: string): Promise<string> {
  await page.goto("/teams/new");
  await page.getByLabel("Team name").fill(name);
  await page.getByLabel("GitHub repo").fill(uniqueRepo());
  await page.getByRole("button", { name: "Create team" }).click();
  await expect(page).toHaveURL(/\/teams\/[^/]+\/settings$/);
  return page.url().split("/").at(-2) ?? "";
}

async function createMemberLink(page: Page): Promise<string> {
  const panel = page.getByRole("region", { name: "Member invite link" });
  await panel.getByRole("button", { name: "Create link" }).click();
  const url = panel.getByText(/\/invite\//);
  await expect(url).toBeVisible();
  return (await url.textContent()) ?? "";
}

async function signedInPage(browser: Browser, user: TestUser): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signInAsTestUser(page, user);
  return page;
}

test.describe("Onboarding", () => {
  // AGENTS.md §2 User flows, flow 1, from sign-in to the dashboard. The tests
  // below cover each step's details.
  test("takes a new lead from sign-in through Settings to the Sprint 1 dashboard", async ({
    page,
    browser,
  }) => {
    // Arrange: a signed-out visitor on the sign-in page
    await page.goto("/signin");
    await expect(
      page
        .getByRole("main")
        .getByRole("button", { name: "Sign in with GitHub" })
    ).toBeVisible();

    // Act: sign in (the test provider stands in for GitHub) and create a team
    await signInAsTestUser(page, JOURNEY_LEAD);
    await page.goto("/");
    await page.getByRole("link", { name: "Create a team" }).click();
    const repo = { id: Date.now(), fullName: uniqueRepo() };
    await page.getByLabel("Team name").fill("Journey team");
    await page.getByLabel("GitHub repo").fill(repo.fullName);
    await page.getByRole("button", { name: "Create team" }).click();

    // Assert: the creator is the lead, in Settings
    await expect(page).toHaveURL(/\/teams\/[^/]+\/settings$/);
    const teamId = page.url().split("/").at(-2) ?? "";
    const members = page.getByRole("region", { name: "Members and invites" });
    await expect(members.getByRole("listitem")).toContainText("Lead");

    // Act: the partner joins with the member invite link
    const inviteUrl = await createMemberLink(page);
    const partner = await signedInPage(browser, JOURNEY_PARTNER);
    await partner.goto(inviteUrl);
    await partner.getByRole("button", { name: "Join team" }).click();

    // Assert
    await expect(partner).toHaveURL(/\/teams\/[^/]+\/dashboard$/);

    // Act: the lead copies the webhook URL and secret into GitHub, following
    // the setup steps
    const secret = await copyWebhookSecret(page, teamId);
    const repository = page.getByRole("region", { name: "Repository" });
    // Pending until GitHub's ping arrives (decision 007, #117).
    const connection = repository.getByTestId("repository-connection");
    await expect(connection).toHaveText("Waiting for GitHub's ping");
    const webhookUrl =
      (await repository.getByText(/\/api\/webhooks\/github$/).textContent()) ??
      "";
    await repository.getByText("Webhook setup steps").click();
    await expect(
      repository.getByText("Paste the Webhook URL into Payload URL.")
    ).toBeVisible();
    await expectNoBlockingViolations(page);
    // GitHub then sends a ping to that URL, signed with that secret.
    const pinged = await deliverWebhook(page.request, {
      secret,
      event: "ping",
      deliveryId: crypto.randomUUID(),
      payload: {
        zen: "Keep it logically awesome.",
        hook_id: 1,
        repository: {
          id: repo.id,
          name: "sprintproof",
          full_name: repo.fullName,
        },
        sender: { login: JOURNEY_LEAD.login },
      },
    });

    // Assert: the ping connected the repository, and Settings shows it as
    // the verified delivery
    expect(new URL(webhookUrl).pathname).toBe("/api/webhooks/github");
    expect(pinged.status()).toBe(200);
    await page.reload();
    await expect(connection).toHaveText("Connected");
    await expect(repository).toContainText(
      /Last delivery\s*ping at .+Verified/
    );

    // Act: the lead adds Sprint 1 under "Sprints and requirements"
    const sprints = page.getByRole("region", {
      name: "Sprints and requirements",
    });
    await sprints.getByRole("button", { name: "Add sprint" }).click();
    await sprints.getByLabel("Sprint name").fill("Sprint 1");
    await sprints.getByLabel("Start date").fill(isoDate(-3));
    await sprints.getByLabel("End date").fill(isoDate(3));
    await expect(sprints.getByLabel("Standups per person")).toHaveValue("3");
    await expect(sprints.getByLabel("PR reviews per person")).toHaveValue("5");
    await sprints.getByRole("button", { name: "Save sprint" }).click();

    // Assert
    await expect(sprints.getByRole("row", { name: /Sprint 1/ })).toContainText(
      "Current"
    );

    // Act: open the dashboard
    await page
      .getByRole("navigation", { name: "Team" })
      .getByRole("link", { name: "Dashboard" })
      .click();

    // Assert: Sprint 1, with a card per member, the lead's first
    await expect(page).toHaveURL(new RegExp(`/teams/${teamId}/dashboard$`));
    const main = page.getByRole("main");
    await expect(
      main.getByRole("heading", { level: 1, name: "Sprint 1" })
    ).toBeVisible();
    await expect(
      main.getByText("3 standups and 5 PR reviews per person")
    ).toBeVisible();
    await expect(
      main.getByRole("region", { name: "Your requirements" })
    ).toBeVisible();
    const cards = main.getByRole("article");
    await expect(cards).toHaveCount(2);
    await expect(cards.first()).toContainText("Ziqi (Odie) Yang (you)");
    await expect(cards.nth(1)).toContainText(JOURNEY_PARTNER.name);
    await expectNoBlockingViolations(page);
  });

  test("creates a team and makes the creator its lead", async ({ page }) => {
    // Arrange
    await signInAsTestUser(page, LEAD);
    await page.goto("/");

    // Act
    await page.getByRole("link", { name: "Create a team" }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Create a team" })
    ).toBeVisible();
    // The lead invites the partner; the TA's link comes from course staff (#116).
    await expect(
      page.getByText(
        "You'll be the team lead. Invite your partner from Settings next."
      )
    ).toBeVisible();
    await expect(page.getByLabel("Team timezone")).toHaveValue(
      "America/Los_Angeles"
    );
    await page.getByLabel("Team name").fill("Onboarding team");
    await page.getByLabel("GitHub repo").fill(uniqueRepo());
    await page.getByRole("button", { name: "Create team" }).click();

    // Assert
    await expect(page).toHaveURL(/\/teams\/[^/]+\/settings$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Settings" })
    ).toBeVisible();
    const members = page.getByRole("region", { name: "Members and invites" });
    await expect(members.getByRole("listitem")).toHaveCount(1);
    await expect(members.getByRole("listitem")).toContainText(
      "Ziqi (Odie) Yang (you)"
    );
    await expect(members.getByRole("listitem")).toContainText("Lead");
  });

  test("shows field errors for a repo that isn't owner/name", async ({
    page,
  }) => {
    // Arrange
    await signInAsTestUser(page, LEAD);
    await page.goto("/teams/new");

    // Act
    await page.getByLabel("Team name").fill("Bad repo team");
    await page.getByLabel("GitHub repo").fill("https://github.com/a/b");
    await page.getByRole("button", { name: "Create team" }).click();

    // Assert
    const repo = page.getByLabel("GitHub repo");
    await expect(repo).toHaveAttribute("aria-invalid", "true");
    await expect(repo).toHaveAccessibleDescription(
      /Use the owner\/name format, for example Odiethebest\/SprintProof\./
    );
    await expect(page).toHaveURL(/\/teams\/new$/);
  });

  test("lets a partner join with the member link, once", async ({
    page,
    browser,
  }) => {
    // Arrange
    await signInAsTestUser(page, LEAD);
    await createTeam(page, "Partner team");
    const inviteUrl = await createMemberLink(page);
    const partner = await signedInPage(browser, PARTNER);

    // Act
    await partner.goto(inviteUrl);
    await expect(
      partner.getByRole("heading", { level: 1, name: "Join Partner team" })
    ).toBeVisible();
    await expect(partner.getByText("You'll join as a member.")).toBeVisible();
    await partner.getByRole("button", { name: "Join team" }).click();

    // Assert
    await expect(partner).toHaveURL(/\/teams\/[^/]+\/dashboard$/);
    await partner.goto("/");
    const team = partner.getByRole("link", { name: /Partner team/ });
    await expect(team.first()).toContainText("Member");
    await partner.goto(inviteUrl);
    await expect(
      partner.getByRole("heading", {
        level: 1,
        name: "You're already on Partner team",
      })
    ).toBeVisible();
    await page.reload();
    const members = page.getByRole("region", { name: "Members and invites" });
    await expect(members.getByRole("listitem")).toHaveCount(2);
  });

  test("shows a clear error for a revoked link", async ({ page, browser }) => {
    // Arrange
    await signInAsTestUser(page, LEAD);
    await createTeam(page, "Revoke team");
    const inviteUrl = await createMemberLink(page);
    const panel = page.getByRole("region", { name: "Member invite link" });

    // Act
    await panel.getByRole("button", { name: "Revoke" }).click();
    await expect(
      panel.getByRole("button", { name: "Create link" })
    ).toBeVisible();
    const partner = await signedInPage(browser, PARTNER);
    await partner.goto(inviteUrl);

    // Assert
    await expect(
      partner.getByRole("heading", {
        level: 1,
        name: "This invite link can't be used",
      })
    ).toBeVisible();
    await expect(
      partner.getByText(
        "This invite link was revoked. Ask your team lead for a new one."
      )
    ).toBeVisible();
  });

  test("shows a clear error for an unknown link", async ({ page }) => {
    // Arrange
    await signInAsTestUser(page, PARTNER);

    // Act
    await page.goto("/invite/not-a-real-token");

    // Assert
    await expect(
      page.getByText(
        "This invite link doesn't work. Check that you copied the whole link, or ask your team lead for a new one."
      )
    ).toBeVisible();
  });

  test("sends a signed-out visitor from an invite link to sign-in", async ({
    page,
  }) => {
    // Act
    await page.goto("/invite/some-token");

    // Assert
    await expect(page).toHaveURL(
      /\/signin\?callbackUrl=%2Finvite%2Fsome-token$/
    );
    await expect(
      page.getByText("Sign in to continue to your invite.")
    ).toBeVisible();
  });

  test("doesn't show invite links to a member", async ({ page, browser }) => {
    // Arrange
    await signInAsTestUser(page, LEAD);
    await createTeam(page, "Member view team");
    const inviteUrl = await createMemberLink(page);
    const settingsUrl = page.url();
    const partner = await signedInPage(browser, PARTNER);
    await partner.goto(inviteUrl);
    await partner.getByRole("button", { name: "Join team" }).click();
    await expect(partner).toHaveURL(/\/teams\/[^/]+\/dashboard$/);

    // Act
    await partner.goto(settingsUrl);

    // Assert
    const members = partner.getByRole("region", {
      name: "Members and invites",
    });
    await expect(members.getByRole("listitem")).toHaveCount(2);
    await expect(
      partner.getByRole("region", { name: "Member invite link" })
    ).toHaveCount(0);
    await expect(partner.getByRole("button", { name: "Revoke" })).toHaveCount(
      0
    );
    await expect(partner.getByText(COURSE_STAFF_NOTE)).toHaveCount(0);
  });

  test("doesn't offer the lead an instructor link and says who creates them", async ({
    page,
  }) => {
    // Arrange: decision 006, #116: otherwise a lead could join their own team
    // as an instructor with a second account and read peer feedback.
    await signInAsTestUser(page, LEAD);

    // Act
    const teamId = await createTeam(page, "Lead invites team");

    // Assert
    const members = page.getByRole("region", { name: "Members and invites" });
    await expect(
      members.getByRole("region", { name: "Member invite link" })
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Instructor invite link" })
    ).toHaveCount(0);
    await expect(members.getByText(COURSE_STAFF_NOTE)).toBeVisible();
    const refused = await page.request.post(`/api/v1/teams/${teamId}/invites`, {
      data: { role: "INSTRUCTOR" },
    });
    expect(refused.status()).toBe(403);
    await expectNoBlockingViolations(page);
  });

  test("lets course staff invite an instructor, who then manages the instructor link in Settings", async ({
    page,
    browser,
  }) => {
    // Arrange: course staff aren't on the team; they create the link through
    // the API with their session, the way /api-docs sends it.
    await signInAsTestUser(page, INSTRUCTOR_LEAD);
    const teamId = await createTeam(page, "Staff invites team");
    const staff = await signedInPage(browser, COURSE_STAFF.onboarding);
    const created = await staff.request.post(
      `/api/v1/teams/${teamId}/invites`,
      { data: { role: "INSTRUCTOR" } }
    );
    expect(created.status()).toBe(201);
    const { token } = (await created.json()) as { token: string };
    const instructor = await signedInPage(browser, INSTRUCTOR);
    await instructor.goto(`/invite/${token}`);
    await expect(
      instructor.getByText(
        "You'll join as an instructor, with read-only access."
      )
    ).toBeVisible();
    await instructor.getByRole("button", { name: "Join team" }).click();
    await expect(instructor).toHaveURL(/\/teams\/[^/]+\/dashboard$/);

    // Act
    await instructor.goto(`/teams/${teamId}/settings`);

    // Assert: the instructor link, and no member link or note
    const panel = instructor.getByRole("region", {
      name: "Instructor invite link",
    });
    await expect(panel.getByText(`/invite/${token}`)).toBeVisible();
    await expect(
      instructor.getByRole("region", { name: "Member invite link" })
    ).toHaveCount(0);
    await expect(instructor.getByText(COURSE_STAFF_NOTE)).toHaveCount(0);
    await expectNoBlockingViolations(instructor);

    // Act: revoke it and create a new one
    await panel.getByRole("button", { name: "Revoke" }).click();
    await panel.getByRole("button", { name: "Create link" }).click();

    // Assert
    await expect(panel.getByText(/\/invite\//)).toBeVisible();
    await expect(panel.getByText(`/invite/${token}`)).toHaveCount(0);
    await page.reload();
    const members = page.getByRole("region", { name: "Members and invites" });
    await expect(members.getByRole("listitem")).toHaveCount(2);
    await expect(members.getByRole("listitem").nth(1)).toContainText(
      "Instructor"
    );
  });

  test("shows the webhook URL and setup steps for the lead in Settings", async ({
    page,
  }) => {
    // Arrange
    await signInAsTestUser(page, LEAD);
    await page.goto("/teams/new");
    await page.getByLabel("Team name").fill("Webhook Settings Team");
    const repo = uniqueRepo();
    await page.getByLabel("GitHub repo").fill(repo);
    await page.getByRole("button", { name: "Create team" }).click();
    await expect(page).toHaveURL(/\/teams\/[^/]+\/settings$/);

    // Assert
    const repositorySection = page.getByRole("region", { name: "Repository" });
    await expect(repositorySection).toBeVisible();
    await expect(repositorySection.getByText(repo)).toBeVisible();
    await expect(
      repositorySection.getByText(/\/api\/webhooks\/github/)
    ).toBeVisible();
    await expect(
      repositorySection.getByText("Webhook setup steps")
    ).toBeVisible();
    await expectNoBlockingViolations(page);
  });

  test("has no serious or critical accessibility violations", async ({
    page,
    browser,
  }) => {
    // Arrange
    await signInAsTestUser(page, LEAD);

    // Act and assert: home, create team, settings, invite page
    await page.goto("/");
    await expect(
      page.getByRole("heading", { level: 1, name: "Your teams" })
    ).toBeVisible();
    await expectNoBlockingViolations(page);

    await page.goto("/teams/new");
    await expect(
      page.getByRole("heading", { level: 1, name: "Create a team" })
    ).toBeVisible();
    await expectNoBlockingViolations(page);

    await createTeam(page, "Axe team");
    const inviteUrl = await createMemberLink(page);
    await expectNoBlockingViolations(page);

    const partner = await signedInPage(browser, PARTNER);
    await partner.goto(inviteUrl);
    await expect(
      partner.getByRole("button", { name: "Join team" })
    ).toBeVisible();
    await expectNoBlockingViolations(partner);
  });
});
