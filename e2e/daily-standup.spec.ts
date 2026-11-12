import { expect, test, type Browser, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { signInAsTestUser, type TestUser } from "./helpers/auth";
import { COURSE_STAFF } from "./helpers/course-staff";
import { createInviteToken } from "./helpers/teams";

// One login per test, so parallel sign-ins never create the same user at once.
const POSTER: TestUser = {
  login: "ziqi-standup-e2e",
  name: "Ziqi (Odie) Yang",
};
const VALIDATOR: TestUser = {
  login: "ziqi-standup-errors-e2e",
  name: "Ziqi (Odie) Yang",
};
const NO_SPRINT_LEAD: TestUser = {
  login: "ziqi-standup-nosprint-e2e",
  name: "Ziqi (Odie) Yang",
};
const LEAD: TestUser = {
  login: "ziqi-standup-lead-e2e",
  name: "Ziqi (Odie) Yang",
};
const INSTRUCTOR: TestUser = {
  login: "ta-standup-e2e",
  name: "Course TA",
};

const DAY_MS = 24 * 60 * 60 * 1000;

function uniqueRepo(): string {
  return `e2e-${Date.now()}-${Math.floor(Math.random() * 1000)}/sprintproof`;
}

function isoDate(offsetDays: number): string {
  return new Date(Date.now() + offsetDays * DAY_MS).toISOString().slice(0, 10);
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
  await expect(page).toHaveURL(/\/teams\/[^/]+\/settings$/);
  return page.url().split("/").at(-2) ?? "";
}

// A sprint that runs from 3 days ago to 3 days from now, wide enough that
// today is inside it in any timezone.
async function addCurrentSprint(page: Page, teamId: string): Promise<void> {
  const response = await page.request.post(`/api/v1/teams/${teamId}/sprints`, {
    data: { name: "Sprint 1", startDate: isoDate(-3), endDate: isoDate(3) },
  });
  expect(response.status()).toBe(201);
}

async function signedInPage(browser: Browser, user: TestUser): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signInAsTestUser(page, user);
  return page;
}

test.describe("Daily standup", () => {
  test("posts today's standup, lists it in History and updates it the same day", async ({
    page,
  }) => {
    // Arrange
    await signInAsTestUser(page, POSTER);
    const teamId = await createTeam(page, "Standup team");
    await addCurrentSprint(page, teamId);
    await page.goto(`/teams/${teamId}/standups`);
    await expect(
      page.getByRole("heading", { level: 1, name: "Standups" })
    ).toBeVisible();
    const form = page.getByRole("region", { name: "Today's standup" });
    const history = page.getByRole("region", { name: "History" });
    await expect(form.getByText(/filed under Sprint 1$/)).toBeVisible();
    await expect(
      history.getByText("No standups in Sprint 1 yet.")
    ).toBeVisible();
    await expectNoBlockingViolations(page);

    // Act: post
    await form.getByLabel("Yesterday", { exact: true }).fill("Wrote the API.");
    await expect(form.getByText("14 / 1000")).toBeVisible();
    await form
      .getByLabel("Today", { exact: true })
      .fill("Build the standups page.");
    await form.getByRole("button", { name: "Post standup" }).click();

    // Assert: posted
    await expect(page.getByRole("status")).toHaveText("Standup posted.");
    await expect(
      form.getByText(
        /^Posted at \d{1,2}:\d{2}\s[AP]M\. Saving again updates it\.$/
      )
    ).toBeVisible();
    const entries = history.getByRole("listitem");
    await expect(entries).toHaveCount(1);
    await expect(entries.first()).toContainText("Ziqi (Odie) Yang");
    await expect(entries.first()).toContainText("Build the standups page.");
    await expect(entries.first()).toContainText("None");
    await expect(history.getByText("1 standup", { exact: true })).toBeVisible();

    // Act: save again the same day
    await form
      .getByLabel("Today", { exact: true })
      .fill("Write the E2E spec for #9.");
    await form.getByLabel("Blockers").fill("Waiting on a review.");
    await form.getByRole("button", { name: "Update today's standup" }).click();

    // Assert: still one standup, now edited
    await expect(page.getByRole("status")).toHaveText("Standup updated.");
    await expect(entries).toHaveCount(1);
    await expect(entries.first()).toContainText("Write the E2E spec for #9.");
    await expect(entries.first()).toContainText("Waiting on a review.");
    await expect(entries.first()).toContainText("edited");
    await expectNoBlockingViolations(page);
  });

  test("shows each error under its field and moves focus to the first one", async ({
    page,
  }) => {
    // Arrange
    await signInAsTestUser(page, VALIDATOR);
    const teamId = await createTeam(page, "Standup errors team");
    await addCurrentSprint(page, teamId);
    await page.goto(`/teams/${teamId}/standups`);
    const form = page.getByRole("region", { name: "Today's standup" });

    // Act
    await form.getByRole("button", { name: "Post standup" }).click();

    // Assert
    const yesterday = form.getByLabel("Yesterday", { exact: true });
    const today = form.getByLabel("Today", { exact: true });
    await expect(yesterday).toBeFocused();
    await expect(yesterday).toHaveAttribute("aria-invalid", "true");
    await expect(yesterday).toHaveAccessibleDescription(
      /Add what you worked on yesterday\./
    );
    await expect(today).toHaveAttribute("aria-invalid", "true");
    await expect(today).toHaveAccessibleDescription(
      /Add what you plan to work on today\./
    );
    await expect(form.getByLabel("Blockers")).not.toHaveAttribute(
      "aria-invalid",
      "true"
    );
    await expect(
      page.getByRole("region", { name: "History" }).getByRole("listitem")
    ).toHaveCount(0);
    await expectNoBlockingViolations(page);
  });

  test("explains that today isn't in a sprint in place of the form", async ({
    page,
  }) => {
    // Arrange
    await signInAsTestUser(page, NO_SPRINT_LEAD);
    const teamId = await createTeam(page, "No sprint team");

    // Act
    await page.goto(`/teams/${teamId}/standups`);

    // Assert
    const form = page.getByRole("region", { name: "Today's standup" });
    await expect(
      form.getByText(
        /isn't in any sprint, so there's nothing to file a standup under\./
      )
    ).toBeVisible();
    await expect(form.getByRole("link", { name: "Settings" })).toHaveAttribute(
      "href",
      `/teams/${teamId}/settings`
    );
    await expect(form.getByRole("textbox")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Post standup" })
    ).toHaveCount(0);
    await expect(
      page
        .getByRole("region", { name: "History" })
        .getByText("No sprint is running today.")
    ).toBeVisible();
    await expectNoBlockingViolations(page);
  });

  test("shows an instructor the history without the form", async ({
    page,
    browser,
  }) => {
    // Arrange: the lead posts a standup; course staff invite an instructor,
    // because instructor links don't come from the lead (decision 006, #116)
    await signInAsTestUser(page, LEAD);
    const teamId = await createTeam(page, "Instructor standup team");
    await addCurrentSprint(page, teamId);
    const posted = await page.request.post(`/api/v1/teams/${teamId}/standups`, {
      data: { yesterday: "Wrote the API.", today: "Review #50." },
    });
    expect(posted.status()).toBe(201);
    const staff = await signedInPage(browser, COURSE_STAFF.standup);
    const token = await createInviteToken(staff, {
      teamId,
      role: "INSTRUCTOR",
    });
    const instructor = await signedInPage(browser, INSTRUCTOR);
    await instructor.goto(`/invite/${token}`);
    await instructor.getByRole("button", { name: "Join team" }).click();
    await expect(instructor).toHaveURL(/\/teams\/[^/]+\/dashboard$/);

    // Act
    await instructor.goto(`/teams/${teamId}/standups`);

    // Assert
    const history = instructor.getByRole("region", { name: "History" });
    await expect(history.getByRole("listitem")).toHaveCount(1);
    await expect(history).toContainText("Review #50.");
    await expect(
      instructor.getByRole("region", { name: "Today's standup" })
    ).toHaveCount(0);
    await expect(instructor.getByRole("textbox")).toHaveCount(0);
    await expectNoBlockingViolations(instructor);
  });
});
