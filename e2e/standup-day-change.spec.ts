import { test, expect, type Page } from "@playwright/test";
import { Pool } from "pg";
import { signInAsTestUser, type TestUser } from "./helpers/auth";
import {
  createTeam,
  addSprint,
  expectNoBlockingViolations,
  joinTeam,
  signedInPage,
} from "./helpers/teams";

const DAY_CHANGED = "The day has changed. Load today's form before saving.";

// The server clock can't be moved from a test, so the team's timezone moves
// instead: from UTC−11 to UTC+14 the team's calendar day always moves forward,
// as it does at midnight. A sprint from 3 days ago to 3 days ahead holds both.
const BEFORE_MIDNIGHT = "Pacific/Pago_Pago";
const AFTER_MIDNIGHT = "Pacific/Kiritimati";

const LOADER: TestUser = { login: "day-change-load-e2e", name: "Day loader" };
const WATCHER: TestUser = { login: "day-change-live-e2e", name: "Day watcher" };
const TEAMMATE: TestUser = {
  login: "day-change-mate-e2e",
  name: "Day teammate",
};

// "Wed, Nov 11", as the form shows the day (DESIGN.md §9).
function dayLabel(timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone,
  }).format(new Date());
}

// Today's YYYY-MM-DD date in the timezone.
function todayIn(timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone,
  }).format(new Date());
}

async function createTeamIn(
  page: Page,
  input: { name: string; timezone: string }
): Promise<string> {
  const response = await page.request.post("/api/v1/teams", {
    data: {
      name: input.name,
      repoFullName: `e2e-${Date.now()}-${Math.floor(Math.random() * 1000)}/sprintproof`,
      timezone: input.timezone,
    },
  });
  expect(response.status()).toBe(201);
  const team = (await response.json()) as { id: string };
  return team.id;
}

// Writes the test's own team row in the local or CI E2E database only.
async function moveTeamToTimezone(input: {
  teamId: string;
  timezone: string;
}): Promise<void> {
  const url = new URL(process.env.DATABASE_URL ?? "");
  expect(["localhost", "127.0.0.1"]).toContain(url.hostname);
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await pool.query("UPDATE teams SET timezone = $1 WHERE id = $2", [
      input.timezone,
      input.teamId,
    ]);
  } finally {
    await pool.end();
  }
}

// The days the user has a standup on in the sprint, as the API stores them.
async function standupDatesOf(
  page: Page,
  input: { teamId: string; sprintId: string; login: string }
): Promise<string[]> {
  const response = await page.request.get(
    `/api/v1/teams/${input.teamId}/sprints/${input.sprintId}/standups`
  );
  expect(response.status()).toBe(200);
  const { data } = (await response.json()) as {
    data: { date: string; author: { githubLogin: string | null } }[];
  };
  return data
    .filter((standup) => standup.author.githubLogin === input.login)
    .map((standup) => standup.date);
}

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
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "The day has changed"
  );
  expect(renderedDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  await expect(
    page.getByRole("button", { name: "Load today's form" })
  ).toBeVisible();
  await expectNoBlockingViolations(page);
  await page.getByRole("button", { name: "Load today's form" }).click();
  // #91: loading today's form keeps what the user hadn't sent.
  await expect(page.getByLabel("Yesterday", { exact: true })).toHaveValue(
    "Yesterday's work"
  );
  await expect(page.getByLabel("Today", { exact: true })).toHaveValue(
    "Today's work"
  );
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Post standup" })
  ).toBeEnabled();
});

test("after midnight, Load today's form shows the new day and keeps the unsent text", async ({
  page,
}) => {
  // Arrange: the form is open on the old day with unsent text
  await signInAsTestUser(page, LOADER);
  const teamId = await createTeamIn(page, {
    name: "Midnight team",
    timezone: BEFORE_MIDNIGHT,
  });
  const sprintId = await addSprint(page, {
    teamId,
    name: "Current",
    startOffset: -3,
    endOffset: 3,
  });
  await page.goto(`/teams/${teamId}/standups`);
  const form = page.getByRole("region", { name: "Today's standup" });
  await expect(form).toContainText(
    `${dayLabel(BEFORE_MIDNIGHT)}, filed under Current`
  );
  await form
    .getByLabel("Yesterday", { exact: true })
    .fill("Typed at 11:58 PM.");
  await form.getByLabel("Today", { exact: true }).fill("Not sent yet.");

  // Act: midnight passes in the team's timezone, then the user posts
  await moveTeamToTimezone({ teamId, timezone: AFTER_MIDNIGHT });
  await form.getByRole("button", { name: "Post standup" }).click();

  // Assert: the old day is refused and nothing is saved
  await expect(form.getByRole("alert")).toHaveText(DAY_CHANGED);
  await expect(
    form.getByRole("button", { name: "Load today's form" })
  ).toBeFocused();
  await expect(form.getByLabel("Today", { exact: true })).toHaveValue(
    "Not sent yet."
  );
  await expect(
    form.getByRole("button", { name: "Post standup" })
  ).toBeDisabled();
  expect(
    await standupDatesOf(page, { teamId, sprintId, login: LOADER.login })
  ).toEqual([]);

  // Act
  await form.getByRole("button", { name: "Load today's form" }).click();

  // Assert: the new day, with the text the user hadn't sent
  await expect(form).toContainText(
    `${dayLabel(AFTER_MIDNIGHT)}, filed under Current`
  );
  await expect(form.getByLabel("Yesterday", { exact: true })).toHaveValue(
    "Typed at 11:58 PM."
  );
  await expect(form.getByLabel("Today", { exact: true })).toHaveValue(
    "Not sent yet."
  );
  await expect(form.getByRole("alert")).toHaveCount(0);
  await expect(form.getByLabel("Yesterday", { exact: true })).toBeFocused();
  await expect(page.getByRole("status")).toHaveText(
    `Loaded today's form for ${dayLabel(AFTER_MIDNIGHT)}.`
  );
  await expectNoBlockingViolations(page);

  // Act: post on the new day
  await form.getByRole("button", { name: "Post standup" }).click();

  // Assert: filed under the day the form showed
  await expect(page.getByRole("status")).toHaveText("Standup posted.");
  expect(
    await standupDatesOf(page, { teamId, sprintId, login: LOADER.login })
  ).toEqual([todayIn(AFTER_MIDNIGHT)]);
});

test("a live refresh after midnight keeps the unsent text and says the day changed", async ({
  page,
  browser,
}) => {
  // Needs a Pusher-compatible server: playwright.config.ts points the app at a
  // local Soketi container (see README "Running the tests").

  // Arrange: the watcher's form is open on the old day with unsent text
  await signInAsTestUser(page, WATCHER);
  const teamId = await createTeamIn(page, {
    name: "Live midnight team",
    timezone: BEFORE_MIDNIGHT,
  });
  const sprintId = await addSprint(page, {
    teamId,
    name: "Current",
    startOffset: -3,
    endOffset: 3,
  });
  const teammate = await signedInPage(browser, TEAMMATE);
  await joinTeam({ lead: page, joiner: teammate, teamId, role: "MEMBER" });
  await page.goto(`/teams/${teamId}/standups`);
  await expect(
    page.getByRole("banner").getByText("Live", { exact: true })
  ).toBeVisible({ timeout: 10_000 });
  const form = page.getByRole("region", { name: "Today's standup" });
  const oldDay = `${dayLabel(BEFORE_MIDNIGHT)}, filed under Current`;
  await expect(form).toContainText(oldDay);
  await form
    .getByLabel("Yesterday", { exact: true })
    .fill("Typed at 11:59 PM.");
  await form.getByLabel("Today", { exact: true }).fill("Still typing.");
  // A full page load would drop this marker.
  await page.evaluate(() => Object.assign(window, { noReload: true }));

  // Act: midnight passes, then a teammate posts, which refreshes the page live
  await moveTeamToTimezone({ teamId, timezone: AFTER_MIDNIGHT });
  const posted = await teammate.request.post(
    `/api/v1/teams/${teamId}/standups`,
    { data: { yesterday: "Posted after midnight.", today: "Review #91." } }
  );
  expect(posted.status()).toBe(201);

  // Assert: the refresh arrived; the form keeps the old day and the text
  await expect(page.getByRole("region", { name: "History" })).toContainText(
    "Posted after midnight."
  );
  await expect(form.getByRole("alert")).toHaveText(DAY_CHANGED);
  await expect(form.getByLabel("Yesterday", { exact: true })).toHaveValue(
    "Typed at 11:59 PM."
  );
  await expect(form.getByLabel("Today", { exact: true })).toHaveValue(
    "Still typing."
  );
  await expect(form).toContainText(oldDay);
  await expect(
    form.getByRole("button", { name: "Post standup" })
  ).toBeDisabled();
  expect(
    await standupDatesOf(page, { teamId, sprintId, login: WATCHER.login })
  ).toEqual([]);
  expect(await page.evaluate(() => "noReload" in window)).toBe(true);
  await expectNoBlockingViolations(page);

  // Act
  await form.getByRole("button", { name: "Load today's form" }).click();

  // Assert: the new day, with the same text
  await expect(form).toContainText(
    `${dayLabel(AFTER_MIDNIGHT)}, filed under Current`
  );
  await expect(form.getByLabel("Yesterday", { exact: true })).toHaveValue(
    "Typed at 11:59 PM."
  );
  await expect(form.getByLabel("Today", { exact: true })).toHaveValue(
    "Still typing."
  );
  await expect(form.getByRole("alert")).toHaveCount(0);

  // Act: post on the new day
  await form.getByRole("button", { name: "Post standup" }).click();

  // Assert
  await expect(page.getByRole("status")).toHaveText("Standup posted.");
  expect(
    await standupDatesOf(page, { teamId, sprintId, login: WATCHER.login })
  ).toEqual([todayIn(AFTER_MIDNIGHT)]);
});
