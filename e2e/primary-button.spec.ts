import { expect, test, type Locator, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { signInAsTestUser } from "./helpers/auth";

// Needs the dev server started with E2E_TEST_AUTH=true, AUTH_SECRET and DATABASE_URL.

// Waits for the hover transition to end: a fast machine can otherwise run axe
// on a color halfway through it, which is how #62 passed locally and failed in CI.
// A transition that gets cancelled and restarted rejects `finished`, so this
// waits until the button has no running animation left.
async function hoverUntilSettled(button: Locator): Promise<void> {
  await button.hover();
  await button.evaluate(async (element) => {
    const nextFrame = () =>
      new Promise((resolve) => requestAnimationFrame(resolve));
    await nextFrame();
    await nextFrame();
    let running = element.getAnimations();
    while (running.length > 0) {
      await Promise.allSettled(running.map((animation) => animation.finished));
      await nextFrame();
      running = element.getAnimations();
    }
  });
}

async function expectReadableText(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withRules(["color-contrast"])
    .analyze();
  expect(results.violations).toEqual([]);
}

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`Primary buttons in ${colorScheme} mode`, () => {
    test.use({ colorScheme });

    test("keeps the Sign in with GitHub button readable on hover", async ({
      page,
    }) => {
      // Arrange: the streamed card replaces the static one, and a button
      // swapped in under a resting mouse isn't hovered. The continue message
      // is only on the streamed card.
      await page.goto("/signin?callbackUrl=%2Fteams%2Fdemo-team%2Fdashboard");
      await expect(
        page.getByText("Sign in to continue to the dashboard.")
      ).toBeVisible();
      const button = page
        .getByRole("main")
        .getByRole("button", { name: "Sign in with GitHub" });

      // Act
      await hoverUntilSettled(button);

      // Assert
      await expectReadableText(page);
    });

    test("keeps a primary button readable on hover", async ({ page }) => {
      // Arrange: one login per scheme, so parallel sign-ins don't share a user
      await signInAsTestUser(page, {
        login: `hover-${colorScheme}-e2e`,
        name: "Hover Tester",
      });
      await page.goto("/teams/new");
      const button = page.getByRole("button", { name: "Create team" });

      // Act
      await hoverUntilSettled(button);

      // Assert
      await expectReadableText(page);
    });
  });
}
