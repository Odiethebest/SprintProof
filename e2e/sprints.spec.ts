import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { signInAsTestUser, type TestUser } from "./helpers/auth";

const LEAD: TestUser = { login: "ziqi-sprint-e2e", name: "Ziqi (Odie) Yang" };
const PARTNER: TestUser = {
  login: "yunhong-sprint-e2e",
  name: "Yunhong Huang",
};

function uniqueRepo(): string {
  return `e2e-${Date.now()}-${Math.floor(Math.random() * 1000)}/sprintproof`;
}

function toDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function expectNoBlockingViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  const blocking = results.violations.filter(
    (violation) =>
      violation.impact === "serious" || violation.impact === "critical"
  );
  expect(blocking).toEqual([]);
}

async function createTeam(page: Page, name: string): Promise<string> {
  await page.goto("/teams/new");
  await page.getByLabel("Team name").fill(name);
  await page.getByLabel("GitHub repo").fill(uniqueRepo());
  await page.getByRole("button", { name: "Create team" }).click();
  await expect(page).toHaveURL(/\/teams\/([^/]+)\/settings$/);
  const match = page.url().match(/\/teams\/([^/]+)\/settings$/);
  return match ? match[1] : "";
}

test.describe("Sprints and requirements", () => {
  test("lead can create a current sprint and see it highlighted in the table", async ({
    page,
  }) => {
    // Arrange
    await signInAsTestUser(page, LEAD);
    await createTeam(page, "Sprint Planning Team");

    const section = page.getByRole("region", {
      name: "Sprints and requirements",
    });
    await expect(section).toBeVisible();

    // Act: click Add sprint
    await section.getByRole("button", { name: "Add sprint" }).click();
    await expect(
      section.getByRole("heading", { level: 3, name: "New sprint" })
    ).toBeVisible();

    const today = new Date();
    const startDate = toDateString(
      new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000)
    );
    const endDate = toDateString(
      new Date(today.getTime() + 4 * 24 * 60 * 60 * 1000)
    );

    await section.getByLabel("Sprint name").fill("Sprint 1");
    await section.getByLabel("Start date").fill(startDate);
    await section.getByLabel("End date").fill(endDate);
    await section.getByLabel("Standups per person").fill("3");
    await section.getByLabel("PR reviews per person").fill("5");

    await section.getByRole("button", { name: "Save sprint" }).click();

    // Assert: sprint appears in table and is marked as Current
    const table = section.getByRole("table");
    await expect(table).toBeVisible();

    const currentSprintRow = table.locator("tbody tr[data-current='true']");
    await expect(currentSprintRow).toBeVisible();
    await expect(currentSprintRow).toContainText("Sprint 1");
    await expect(currentSprintRow).toContainText("Current");
    await expect(currentSprintRow).toContainText("3");
    await expect(currentSprintRow).toContainText("5");
    await expect(
      currentSprintRow.getByRole("button", { name: "Edit Sprint 1" })
    ).toBeVisible();

    await expectNoBlockingViolations(page);
  });

  test("start and end date inputs in the sprint form are type='date'", async ({
    page,
  }) => {
    // Arrange
    await signInAsTestUser(page, LEAD);
    await createTeam(page, "Date Input Team");

    const section = page.getByRole("region", {
      name: "Sprints and requirements",
    });

    // Act: click Add sprint
    await section.getByRole("button", { name: "Add sprint" }).click();
    await expect(
      section.getByRole("heading", { level: 3, name: "New sprint" })
    ).toBeVisible();

    // Assert
    await expect(section.getByLabel("Start date")).toHaveAttribute(
      "type",
      "date"
    );
    await expect(section.getByLabel("End date")).toHaveAttribute(
      "type",
      "date"
    );
  });

  test("shows field errors on client when end date is before start date", async ({
    page,
  }) => {
    // Arrange
    await signInAsTestUser(page, LEAD);
    await createTeam(page, "Validation Team");

    const section = page.getByRole("region", {
      name: "Sprints and requirements",
    });

    // Act
    await section.getByRole("button", { name: "Add sprint" }).click();
    await section.getByLabel("Sprint name").fill("Invalid Dates");
    await section.getByLabel("Start date").fill("2026-11-04");
    await section.getByLabel("End date").fill("2026-10-29");
    await section.getByRole("button", { name: "Save sprint" }).click();

    // Assert
    const endDateInput = section.getByLabel("End date");
    await expect(endDateInput).toHaveAttribute("aria-invalid", "true");
    await expect(section).toContainText(
      "End date cannot be before start date."
    );
  });

  test("members can view the sprint list but cannot see add or edit controls", async ({
    page,
    browser,
  }) => {
    // Arrange: lead creates team and sprint
    await signInAsTestUser(page, LEAD);
    const teamId = await createTeam(page, "Member View Team");

    const section = page.getByRole("region", {
      name: "Sprints and requirements",
    });
    await section.getByRole("button", { name: "Add sprint" }).click();

    const today = new Date();
    const startDate = toDateString(
      new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000)
    );
    const endDate = toDateString(
      new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000)
    );

    await section.getByLabel("Sprint name").fill("Sprint Alpha");
    await section.getByLabel("Start date").fill(startDate);
    await section.getByLabel("End date").fill(endDate);
    await section.getByRole("button", { name: "Save sprint" }).click();

    // Lead creates a member invite link
    const invitePanel = page.getByRole("region", {
      name: "Member invite link",
    });
    await invitePanel.getByRole("button", { name: "Create link" }).click();
    const inviteUrlText =
      (await invitePanel.getByText(/\/invite\//).textContent()) ?? "";

    // Act: partner signs in and joins team
    const partnerContext = await browser.newContext();
    const partnerPage = await partnerContext.newPage();
    await signInAsTestUser(partnerPage, PARTNER);

    await partnerPage.goto(inviteUrlText);
    await partnerPage.getByRole("button", { name: /join/i }).click();
    await expect(partnerPage).toHaveURL(/\/$/);

    // Partner navigates to settings
    await partnerPage.goto(`/teams/${teamId}/settings`);

    // Assert: partner sees the sprint table and current sprint, but no Add or Edit buttons
    const partnerSection = partnerPage.getByRole("region", {
      name: "Sprints and requirements",
    });
    await expect(partnerSection).toBeVisible();
    await expect(partnerSection).toContainText("Sprint Alpha");
    await expect(partnerSection).toContainText("Current");

    await expect(
      partnerSection.getByRole("button", { name: "Add sprint" })
    ).toHaveCount(0);
    await expect(
      partnerSection.getByRole("button", { name: "Edit Sprint Alpha" })
    ).toHaveCount(0);
    await expect(
      partnerSection.getByRole("button", { name: /edit/i })
    ).toHaveCount(0);

    await expectNoBlockingViolations(partnerPage);
  });
});
