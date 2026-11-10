import { test, expect } from "@playwright/test";
import { signInAsTestUser } from "./helpers/auth";
import {
  createTeam,
  addSprint,
  expectNoBlockingViolations,
} from "./helpers/teams";

test("a stale standup form offers today's form and sends its rendered date", async ({
  page,
}) => {
  await signInAsTestUser(page, { login: "day-change", name: "Day change" });
  const teamId = await createTeam(page, "Calendar team");
  await addSprint(page, {
    teamId,
    name: "Current",
    startOffset: -3,
    endOffset: 3,
  });
  await page.goto(`/teams/${teamId}/standups`);
  await page.getByLabel("Yesterday", { exact: true }).fill("Yesterday's work");
  await page.getByLabel("Today", { exact: true }).fill("Today's work");
  let renderedDate: unknown;
  await page.route(`**/api/v1/teams/${teamId}/standups`, async (route) => {
    renderedDate = route.request().postDataJSON().formDate;
    await route.fulfill({
      status: 409,
      json: {
        error: {
          code: "STANDUP_DAY_CHANGED",
          message: "The day has changed. Load today's form before saving.",
        },
      },
    });
  });
  await page.getByRole("button", { name: "Post standup" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("The day has changed");
  expect(renderedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  await expect(
    page.getByRole("button", { name: "Load today's form" })
  ).toBeVisible();
  await expectNoBlockingViolations(page);
  await page.getByRole("button", { name: "Load today's form" }).click();
  await expect(page.getByLabel("Today", { exact: true })).toHaveValue("");
});
