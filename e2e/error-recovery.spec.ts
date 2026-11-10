import { test, expect } from "@playwright/test";
import { Pool } from "pg";
import { signInAsTestUser } from "./helpers/auth";
import {
  createTeam,
  addSprint,
  expectNoBlockingViolations,
} from "./helpers/teams";

test("a failed team page keeps navigation and recovers with Try again", async ({
  page,
}) => {
  await signInAsTestUser(page, {
    login: "error-recovery",
    name: "Error recovery",
  });
  const teamId = await createTeam(page, "Recovery team");
  await addSprint(page, {
    teamId,
    name: "Current",
    startOffset: -3,
    endOffset: 3,
  });
  // Local or CI E2E database only (CI uses sprintproof_e2e); restoring in
  // finally also covers failed assertions.
  const url = new URL(process.env.DATABASE_URL ?? "");
  expect(["localhost", "127.0.0.1"]).toContain(url.hostname);
  expect(["/sprintproof", "/sprintproof_e2e"]).toContain(url.pathname);
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  await pool.query("ALTER TABLE standups RENAME TO standups_error_test");
  try {
    await page.goto(`/teams/${teamId}/standups`);
    await expect(
      page.getByRole("heading", { name: "Couldn't load this page" })
    ).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Team" })).toBeVisible();
    await expect(page.getByRole("banner")).toContainText("Recovery team");
    await expect(page.getByRole("main")).not.toContainText(
      /Prisma|stack|SELECT/
    );
    await expectNoBlockingViolations(page);
  } finally {
    await pool.query("ALTER TABLE standups_error_test RENAME TO standups");
    await pool.end();
  }
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(
    page.getByRole("heading", { name: "Standups", exact: true })
  ).toBeVisible();
  await expectNoBlockingViolations(page);
});
