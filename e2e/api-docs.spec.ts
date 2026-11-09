import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Swagger UI loads from a CDN, so this spec needs network access.
async function expectNoBlockingViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  const blocking = results.violations.filter(
    (violation) =>
      violation.impact === "serious" || violation.impact === "critical"
  );
  expect(blocking).toEqual([]);
}

test.describe("API docs", () => {
  test("shows the API reference without signing in", async ({ page }) => {
    // Act
    await page.goto("/api-docs");

    // Assert: public, so no redirect to /signin
    await expect(page).toHaveURL(/\/api-docs$/);
    await expect(page).toHaveTitle("API docs · SprintProof");
    await expect(
      page.getByRole("heading", { name: /SprintProof API/ })
    ).toBeVisible();
    // Swagger UI puts the path in data-path; its visible text has zero-width breaks.
    for (const apiPath of [
      "/teams/{teamId}/sprints",
      "/teams/{teamId}/sprints/{sprintId}/summary",
      "/teams/{teamId}/sprints/{sprintId}/standups",
    ]) {
      await expect(
        page.locator(`.opblock-summary-path[data-path="${apiPath}"]`).first()
      ).toBeVisible();
    }
    await expectNoBlockingViolations(page);
  });

  test("links to the raw OpenAPI file", async ({ page }) => {
    // Act
    await page.goto("/api-docs");

    // Assert: still useful if the CDN is down
    await expect(
      page.getByRole("link", { name: "openapi.yaml" })
    ).toHaveAttribute("href", "/api-docs/openapi.yaml");
  });
});
