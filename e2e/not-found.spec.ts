import { test, expect, type Page } from "@playwright/test";
import { signInAsTestUser, type TestUser } from "./helpers/auth";
import {
  createTeam,
  expectNoBlockingViolations,
  signedInPage,
} from "./helpers/teams";

// One login per test, so parallel sign-ins never create the same user at once.
const SEEKER: TestUser = { login: "not-found-seeker-e2e", name: "Seeker" };
const LEAD: TestUser = { login: "not-found-lead-e2e", name: "Team lead" };
const OUTSIDER: TestUser = {
  login: "not-found-outsider-e2e",
  name: "Outsider",
};

// The 404 page (#100): the app mark, a heading, one neutral sentence and a
// way back to "Your teams", kept out of search results.
async function expectNotFoundPage(page: Page): Promise<void> {
  const main = page.getByRole("main");
  await expect(
    main.getByRole("heading", { level: 1, name: "Page not found" })
  ).toBeVisible();
  await expect(main).toContainText(
    "This page doesn't exist, or you don't have access to it."
  );
  await expect(main.getByRole("link", { name: "Your teams" })).toHaveAttribute(
    "href",
    "/"
  );
  await expect(page).toHaveTitle("Page not found · SprintProof");
  await expect(
    page.locator('meta[name="robots"][content="noindex"]').first()
  ).toBeAttached();
  await expectNoBlockingViolations(page);
}

// No status check on team pages: the team layout calls notFound() inside its
// Suspense boundary, after the shell has gone out with 200, so Next.js renders
// the 404 page in the stream and marks it noindex. Unknown paths answer 404.

test("a signed-in user on an unknown team gets the 404 page and a way back", async ({
  page,
}) => {
  // Arrange
  await signInAsTestUser(page, SEEKER);

  // Act
  await page.goto("/teams/does-not-exist/dashboard");

  // Assert
  await expectNotFoundPage(page);

  // Act: back into the app
  await page
    .getByRole("main")
    .getByRole("link", { name: "Your teams" })
    .click();

  // Assert
  await expect(
    page.getByRole("heading", { level: 1, name: "Your teams" })
  ).toBeVisible();
});

test("a team the user isn't on gets the same 404 page on every team page", async ({
  page,
  browser,
}) => {
  // Arrange
  await signInAsTestUser(page, LEAD);
  const teamId = await createTeam(page, "Someone else's team");
  const outsider = await signedInPage(browser, OUTSIDER);

  for (const section of ["dashboard", "standups", "settings"]) {
    // Act
    await outsider.goto(`/teams/${teamId}/${section}`);

    // Assert: nothing about the team shows
    await expectNotFoundPage(outsider);
    await expect(outsider.getByText("Someone else's team")).toHaveCount(0);
  }
});

test("an unknown path answers 404 with the 404 page", async ({ page }) => {
  // Act
  const response = await page.goto("/no-such-page");

  // Assert
  expect(response?.status()).toBe(404);
  await expectNotFoundPage(page);
});
