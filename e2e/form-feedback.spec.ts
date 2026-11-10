import { test, expect } from "@playwright/test";
import { signInAsTestUser } from "./helpers/auth";
import {
  createTeam,
  addSprint,
  expectNoBlockingViolations,
} from "./helpers/teams";

test("new invite links do not inherit Copied from a revoked URL", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await signInAsTestUser(page, { login: "invite-copy", name: "Invite copy" });
  await createTeam(page, "Invite copy");
  const panel = page.getByRole("region", {
    name: "Member invite link",
    exact: true,
  });
  await panel.getByRole("button", { name: "Create link" }).click();
  await panel.getByRole("button", { name: "Copy link" }).click();
  await expect(panel.getByRole("button", { name: "Copied" })).toBeVisible();
  await panel.getByRole("button", { name: "Revoke" }).click();
  await panel.getByRole("button", { name: "Create link" }).click();
  await expect(panel.getByRole("button", { name: "Copy link" })).toBeVisible();
  await expectNoBlockingViolations(page);
});
test("the standup counter agrees with emoji and trimmed input validation", async ({
  page,
}) => {
  await signInAsTestUser(page, { login: "counter", name: "Counter" });
  const teamId = await createTeam(page, "Counter team");
  await addSprint(page, {
    teamId,
    name: "Current",
    startOffset: -3,
    endOffset: 3,
  });
  await page.goto(`/teams/${teamId}/standups`);
  await page
    .getByLabel("Yesterday", { exact: true })
    .fill("  " + "😀".repeat(501) + "\n");
  await expect(page.getByText("501 / 1000", { exact: true })).toBeVisible();
  await page.getByLabel("Today", { exact: true }).fill("a".repeat(1000) + "\n");
  await expect(page.getByText("1000 / 1000", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Post standup" }).click();
  await expect(
    page.getByRole("button", { name: "Update today's standup" })
  ).toBeVisible();
  await expectNoBlockingViolations(page);
});
test("a created team with an unreadable success body shows a recovery link", async ({
  page,
}) => {
  await signInAsTestUser(page, { login: "team-body", name: "Team body" });
  await page.goto("/teams/new");
  await page.getByLabel("Team name").fill("Unreadable team");
  await page.getByLabel("GitHub repo").fill(`body-${Date.now()}/repo`);
  await page.route("**/api/v1/teams", async (route) => {
    const response = await route.fetch();
    expect(response.status()).toBe(201);
    await route.fulfill({ response, body: "{broken" });
  });
  await page.getByRole("button", { name: "Create team" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Team created"
  );
  await expect(
    page.getByRole("link", { name: "View your teams" })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Create team" })
  ).toBeDisabled();
  await expectNoBlockingViolations(page);
});
test("a created token with an unreadable body explains how to recover", async ({
  page,
}) => {
  await signInAsTestUser(page, { login: "token-body", name: "Token body" });
  await createTeam(page, "Token body");
  const tokenName = `Unreadable token ${Date.now()}`;
  await page.getByLabel("New token name").fill(tokenName);
  await page.route("**/api/v1/tokens", async (route) => {
    const response = await route.fetch();
    expect(response.status()).toBe(201);
    await route.fulfill({ response, body: "{broken" });
  });
  await page.getByRole("button", { name: "Create token" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Token created, but it couldn't be shown. Revoke it and create another."
  );
  await expect(
    page.getByRole("button", { name: `Revoke ${tokenName}`, exact: true })
  ).toBeVisible();
  await expectNoBlockingViolations(page);
});
test("timezone choices offer UTC and modern names", async ({ page }) => {
  await signInAsTestUser(page, {
    login: "timezone-options",
    name: "Timezone options",
  });
  await page.goto("/teams/new");
  const options = await page
    .getByLabel("Team timezone")
    .locator("option")
    .allTextContents();
  expect(options).toEqual(
    expect.arrayContaining([
      "UTC",
      "Asia/Kolkata",
      "Europe/Kyiv",
      "America/Nuuk",
    ])
  );
  expect(options).not.toContain("Europe/Kiev");
  await expectNoBlockingViolations(page);
});
