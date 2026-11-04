import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { signInAsTestUser } from "./helpers/auth";

// Needs the dev server started with E2E_TEST_AUTH=true, AUTH_SECRET and DATABASE_URL.
const TEST_USER = { login: "ziqi-e2e", name: "Ziqi (Odie) Yang" };

test.describe("Sign in with GitHub", () => {
  test("sends a signed-out visitor from a team page to sign-in", async ({
    page,
  }) => {
    // Act
    await page.goto("/teams/demo-team/dashboard");

    // Assert
    await expect(page).toHaveURL(
      /\/signin\?callbackUrl=%2Fteams%2Fdemo-team%2Fdashboard$/
    );
    await expect(
      page.getByRole("heading", { level: 1, name: "Sign in to SprintProof" })
    ).toBeVisible();
    await expect(
      page.getByText("Sign in to continue to the dashboard.")
    ).toBeVisible();
  });

  test("sends a signed-out visitor from the review page to sign-in", async ({
    page,
  }) => {
    // Act
    await page.goto("/review/demo-team");

    // Assert
    await expect(page).toHaveURL(
      /\/signin\?callbackUrl=%2Freview%2Fdemo-team$/
    );
    await expect(
      page.getByText("Sign in to continue to the review page.")
    ).toBeVisible();
  });

  test("shows a single Sign in with GitHub button and no password field", async ({
    page,
  }) => {
    // Act
    await page.goto("/signin");

    // Assert
    const main = page.getByRole("main");
    await expect(main.getByRole("button")).toHaveCount(1);
    await expect(
      main.getByRole("button", { name: "Sign in with GitHub" })
    ).toBeVisible();
    await expect(main.locator('input[type="password"]')).toHaveCount(0);
    await expect(
      main.getByText(
        "No new password. SprintProof uses your GitHub id, login, name and avatar so your commits, PRs and reviews show up under your name."
      )
    ).toBeVisible();
  });

  test("has no serious or critical accessibility violations on the sign-in page", async ({
    page,
  }) => {
    // Arrange
    await page.goto("/signin");
    await expect(
      page.getByRole("heading", { level: 1, name: "Sign in to SprintProof" })
    ).toBeVisible();

    // Act
    const results = await new AxeBuilder({ page }).analyze();

    // Assert
    const blocking = results.violations.filter(
      (violation) =>
        violation.impact === "serious" || violation.impact === "critical"
    );
    expect(blocking).toEqual([]);
  });

  test("signs out from the user menu", async ({ page }) => {
    // Arrange
    await signInAsTestUser(page, TEST_USER);
    await page.goto("/");

    // Act
    await page.getByRole("button", { name: /Ziqi \(Odie\) Yang/ }).click();
    await expect(page.getByText("@ziqi-e2e")).toBeVisible();
    await page.getByRole("button", { name: "Sign out" }).click();

    // Assert
    await expect(page).toHaveURL(/\/signin$/);
    await page.goto("/teams/demo-team/dashboard");
    await expect(page).toHaveURL(/\/signin\?callbackUrl=/);
  });
});
