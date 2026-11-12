import { expect, test, type Browser, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { signInAsTestUser, type TestUser } from "./helpers/auth";
import { COURSE_STAFF } from "./helpers/course-staff";

// Needs the dev server started with E2E_TEST_AUTH=true, AUTH_SECRET and DATABASE_URL.
// Data stays in the database between runs, so every team gets its own repo.
const LEAD: TestUser = { login: "ziqi-e2e", name: "Ziqi (Odie) Yang" };
const PARTNER: TestUser = { login: "yunhong-e2e", name: "Yunhong Huang" };
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
