import { expect, test } from "@playwright/test";
import { signInAsTestUser, type TestUser } from "./helpers/auth";
import { COURSE_STAFF } from "./helpers/course-staff";
import {
  addSprint,
  createTeam,
  expectNoBlockingViolations,
  joinAsInstructor,
  joinTeam,
  signedInPage,
} from "./helpers/teams";

// One login per test, so parallel sign-ins never create the same user at once.
const EMPTY_LEAD: TestUser = {
  login: "ziqi-dashboard-empty-e2e",
  name: "Ziqi (Odie) Yang",
};
const LEAD: TestUser = {
  login: "ziqi-dashboard-lead-e2e",
  name: "Ziqi (Odie) Yang",
};
const MEMBER: TestUser = {
  login: "yunhong-dashboard-e2e",
  name: "Yunhong Huang",
};
const SELECTOR_LEAD: TestUser = {
  login: "ziqi-dashboard-selector-e2e",
  name: "Ziqi (Odie) Yang",
};
const INSTRUCTOR_LEAD: TestUser = {
  login: "ziqi-dashboard-instructor-e2e",
  name: "Ziqi (Odie) Yang",
};
const INSTRUCTOR: TestUser = {
  login: "ta-dashboard-e2e",
  name: "Course TA",
};

test.describe("Team dashboard", () => {
  test("shows an empty state until the team has a sprint", async ({ page }) => {
    // Arrange
    await signInAsTestUser(page, EMPTY_LEAD);
    // A unique name: the same test user keeps its teams from earlier runs.
    const teamName = `Empty dashboard team ${Date.now()}`;
    const teamId = await createTeam(page, teamName);

    // Act: open the team from the home page
    await page.goto("/");
    await page.getByRole("link", { name: new RegExp(teamName) }).click();

    // Assert
    await expect(page).toHaveURL(new RegExp(`/teams/${teamId}/dashboard$`));
    await expect(
      page.getByRole("heading", { level: 1, name: "Dashboard" })
    ).toBeVisible();
    await expect(page.getByText("No sprint has started yet.")).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Sprint" })).toHaveCount(0);
    await expectNoBlockingViolations(page);
    await page.getByRole("link", { name: "Add a sprint in Settings" }).click();
    await expect(page).toHaveURL(new RegExp(`/teams/${teamId}/settings$`));
  });

  test("shows the sprint, a card per member with counts and requirements, and the activity feed", async ({
    page,
    browser,
  }) => {
    // Arrange: the lead posts a standup; a member joins
    await signInAsTestUser(page, LEAD);
    const teamId = await createTeam(page, "Dashboard team");
    await addSprint(page, {
      teamId,
      name: "Sprint 1",
      startOffset: -3,
      endOffset: 3,
    });
    const member = await signedInPage(browser, MEMBER);
    await joinTeam({ lead: page, joiner: member, teamId, role: "MEMBER" });
    const posted = await page.request.post(`/api/v1/teams/${teamId}/standups`, {
      data: {
        yesterday: "Wrote the dashboard tests.",
        today: "Build the member cards.",
      },
    });
    expect(posted.status()).toBe(201);

    // Act
    await member.goto(`/teams/${teamId}/dashboard`);

    // Assert: sprint header
    await expect(
      member.getByRole("heading", { level: 1, name: "Sprint 1" })
    ).toBeVisible();
    await expect(member.getByText(/^\d+ days? left$/)).toBeVisible();
    await expect(
      member.getByText("3 standups and 5 PR reviews per person")
    ).toBeVisible();

    // Assert: the signed-in member's summary
    const summary = member.getByRole("region", { name: "Your requirements" });
    await expect(summary).toContainText("On track");
    await expect(summary).toContainText(
      "You've met 0 of 2 requirements. 3 standups and 5 PR reviews to go."
    );

    // Assert: one card per member, the signed-in member first
    const cards = member.getByRole("article");
    await expect(cards).toHaveCount(2);
    await expect(cards.first()).toHaveAccessibleName("Yunhong Huang (you)");
    const leadCard = member.getByRole("article", { name: "Ziqi (Odie) Yang" });
    await expect(leadCard).toContainText("Lead");
    await expect(leadCard.locator("dl")).toHaveText(
      /Commits\s*0\s*PRs\s*0\s*Reviews\s*0\s*Standups\s*1/
    );
    const standupRow = leadCard
      .getByRole("listitem")
      .filter({ hasText: "Standups" });
    await expect(standupRow).toContainText("1 of 3");
    await expect(standupRow).toContainText("On track");
    await expect(standupRow).toContainText("2 to go");
    const reviewRow = leadCard
      .getByRole("listitem")
      .filter({ hasText: "PR reviews" });
    await expect(reviewRow).toContainText("0 of 5");
    await expect(reviewRow).toContainText("5 to go");

    // Assert: activity feed
    const feed = member.getByRole("region", { name: "Activity" });
    const items = feed.getByRole("listitem");
    await expect(items).toHaveCount(1);
    await expect(items.first()).toContainText(
      "Ziqi (Odie) Yang posted a standup"
    );
    await expect(items.first()).toContainText("Build the member cards.");
    await member.mouse.move(0, 0);
    await expectNoBlockingViolations(member);

    // Act: go to Standups through the team navigation
    const nav = member.getByRole("navigation", { name: "Team" });
    await expect(nav.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "aria-current",
      "page"
    );
    await nav.getByRole("link", { name: "Standups" }).click();

    // Assert
    await expect(member).toHaveURL(new RegExp(`/teams/${teamId}/standups$`));
    await expect(
      member.getByRole("heading", { level: 1, name: "Standups" })
    ).toBeVisible();
    await expect(
      member
        .getByRole("navigation", { name: "Team" })
        .getByRole("link", { name: "Standups" })
    ).toHaveAttribute("aria-current", "page");
  });

  test("switches to an ended sprint with the sprint selector, which lists only sprints that have started", async ({
    page,
  }) => {
    // Arrange: one ended, one current and one upcoming sprint
    await signInAsTestUser(page, SELECTOR_LEAD);
    const teamId = await createTeam(page, "Sprint selector team");
    const endedId = await addSprint(page, {
      teamId,
      name: "Sprint 1",
      startOffset: -10,
      endOffset: -4,
    });
    await addSprint(page, {
      teamId,
      name: "Sprint 2",
      startOffset: -3,
      endOffset: 3,
    });
    await addSprint(page, {
      teamId,
      name: "Sprint 3",
      startOffset: 4,
      endOffset: 10,
    });
    await page.goto(`/teams/${teamId}/dashboard`);
    await expect(
      page.getByRole("heading", { level: 1, name: "Sprint 2" })
    ).toBeVisible();
    const selector = page.getByRole("combobox", { name: "Sprint" });
    const options = selector.getByRole("option");
    await expect(options).toHaveCount(2);
    await expect(options.nth(0)).toHaveText(/^Sprint 2 · .+ · Current$/);
    await expect(options.nth(1)).toHaveText(/^Sprint 1 · .+ · Ended$/);

    // Act
    await selector.selectOption(endedId);

    // Assert
    await expect(page).toHaveURL(
      new RegExp(`/teams/${teamId}/dashboard\\?sprint=${endedId}$`)
    );
    await expect(
      page.getByRole("heading", { level: 1, name: "Sprint 1" })
    ).toBeVisible();
    await expect(page.getByText(/^Ended [A-Z][a-z]{2} \d{1,2}$/)).toBeVisible();
    const summary = page.getByRole("region", { name: "Your requirements" });
    await expect(summary).toContainText("Missed");
    await expect(summary).toContainText(
      "Sprint 1 has ended. You met 0 of 2 requirements."
    );
    await expectNoBlockingViolations(page);

    // Act: the selected sprint carries over to Standups
    await page
      .getByRole("navigation", { name: "Team" })
      .getByRole("link", { name: "Standups" })
      .click();

    // Assert: History shows Sprint 1; the form still files under Sprint 2
    await expect(page).toHaveURL(
      new RegExp(`/teams/${teamId}/standups\\?sprint=${endedId}$`)
    );
    const history = page.getByRole("region", { name: "History" });
    await expect(
      history.getByText("No standups in Sprint 1 yet.")
    ).toBeVisible();
    const form = page.getByRole("region", { name: "Today's standup" });
    await expect(form.getByText(/filed under Sprint 2$/)).toBeVisible();
  });

  test("shows instructors the dashboard read-only, without a summary or a card of their own", async ({
    page,
    browser,
  }) => {
    // Arrange
    await signInAsTestUser(page, INSTRUCTOR_LEAD);
    const teamId = await createTeam(page, "Instructor dashboard team");
    await addSprint(page, {
      teamId,
      name: "Sprint 1",
      startOffset: -3,
      endOffset: 3,
    });
    const staff = await signedInPage(browser, COURSE_STAFF.dashboard);
    const instructor = await signedInPage(browser, INSTRUCTOR);
    await joinAsInstructor({ staff, joiner: instructor, teamId });

    // Act
    await instructor.goto(`/teams/${teamId}/dashboard`);

    // Assert
    await expect(
      instructor.getByRole("heading", { level: 1, name: "Sprint 1" })
    ).toBeVisible();
    await expect(instructor.getByText("Read-only")).toBeVisible();
    await expect(
      instructor.getByRole("region", { name: "Your requirements" })
    ).toHaveCount(0);
    const cards = instructor.getByRole("article");
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toHaveAccessibleName("Ziqi (Odie) Yang");
    await expectNoBlockingViolations(instructor);
  });
});
