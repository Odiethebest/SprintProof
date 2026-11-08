import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { signInAsTestUser } from "./helpers/auth";
import { createTeam } from "./helpers/teams";

// Needs the dev server started with E2E_TEST_AUTH=true, AUTH_SECRET and DATABASE_URL.
// Tokens belong to a user and the database keeps them between runs, so every
// test signs in as a new user.
function newUser(label: string) {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  return { login: `${label}-${suffix}`, name: "Token Tester" };
}

async function expectNoBlockingViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  const blocking = results.violations.filter(
    (violation) =>
      violation.impact === "serious" || violation.impact === "critical"
  );
  expect(blocking).toEqual([]);
}

async function openTokensCard(page: Page, label: string) {
  await signInAsTestUser(page, newUser(label));
  const teamId = await createTeam(page, "API token team");
  await page.goto(`/teams/${teamId}/settings`);
  return page.getByRole("region", { name: "API tokens" });
}

async function createToken(page: Page, name: string): Promise<string> {
  const card = page.getByRole("region", { name: "API tokens" });
  await card.getByLabel("New token name").fill(name);
  await card.getByRole("button", { name: "Create token" }).click();
  const value = card.getByTestId("new-api-token");
  await expect(value).toHaveText(/^spk_live_[A-Za-z0-9_-]{43}$/);
  return (await value.textContent()) ?? "";
}

test.describe("API tokens", () => {
  test("creates a token, shows it once and then lists it masked", async ({
    page,
  }) => {
    // Arrange
    const card = await openTokensCard(page, "token-create");
    await expect(card.getByText("No API tokens yet.")).toBeVisible();

    // Act
    const token = await createToken(page, "Grading script");

    // Assert: shown once, with a way to copy it
    await expect(
      card.getByText("Copy your new token now. You won't see it again.")
    ).toBeVisible();
    await expect(
      card.getByRole("button", { name: "Copy token" })
    ).toBeVisible();
    const item = card.getByRole("listitem").filter({
      hasText: "Grading script",
    });
    await expect(item).toContainText(`spk_live_••••${token.slice(-4)}`);
    await expect(item).toContainText("not used yet");
    await expect(card.getByText("No API tokens yet.")).toHaveCount(0);
    await expectNoBlockingViolations(page);

    // Act: come back later
    await page.reload();

    // Assert: still listed, never shown again
    await expect(
      page
        .getByRole("region", { name: "API tokens" })
        .getByRole("listitem")
        .filter({ hasText: "Grading script" })
    ).toBeVisible();
    await expect(page.getByText(token)).toHaveCount(0);
  });

  test("shows an error under the name field when the name is empty", async ({
    page,
  }) => {
    // Arrange
    const card = await openTokensCard(page, "token-error");

    // Act
    await card.getByRole("button", { name: "Create token" }).click();

    // Assert
    const name = card.getByLabel("New token name");
    await expect(name).toHaveAttribute("aria-invalid", "true");
    await expect(name).toHaveAccessibleDescription(/Name the token\./);
    await expect(name).toBeFocused();
    await expect(card.getByTestId("new-api-token")).toHaveCount(0);
    await expectNoBlockingViolations(page);
  });

  test("keeps the token when the revoke dialog is cancelled", async ({
    page,
  }) => {
    // Arrange
    const card = await openTokensCard(page, "token-cancel");
    await createToken(page, "Local scripts");
    const revoke = card.getByRole("button", { name: "Revoke Local scripts" });

    // Act
    await revoke.click();
    const dialog = page.getByRole("dialog", { name: "Revoke Local scripts?" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(
      "Scripts that use this token stop working right away."
    );
    await expectNoBlockingViolations(page);
    await dialog.getByRole("button", { name: "Cancel" }).click();

    // Assert: closed, focus back on the trigger, token still there
    await expect(dialog).toBeHidden();
    await expect(revoke).toBeFocused();
    await expect(
      card.getByRole("listitem").filter({ hasText: "Local scripts" })
    ).toBeVisible();
  });

  test("revokes a token after confirming", async ({ page }) => {
    // Arrange
    const card = await openTokensCard(page, "token-revoke");
    await createToken(page, "Local scripts");

    // Act
    await card.getByRole("button", { name: "Revoke Local scripts" }).click();
    await page
      .getByRole("dialog", { name: "Revoke Local scripts?" })
      .getByRole("button", { name: "Revoke token" })
      .click();

    // Assert
    await expect(
      card.getByRole("listitem").filter({ hasText: "Local scripts" })
    ).toHaveCount(0);
    await expect(card.getByText("No API tokens yet.")).toBeVisible();

    // Act: come back later
    await page.reload();

    // Assert: still gone
    await expect(
      page
        .getByRole("region", { name: "API tokens" })
        .getByText("Local scripts")
    ).toHaveCount(0);
  });
});
