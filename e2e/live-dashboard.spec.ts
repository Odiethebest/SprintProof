import { expect, test, type WebSocketRoute } from "@playwright/test";
import { signInAsTestUser, type TestUser } from "./helpers/auth";
import {
  addSprint,
  createTeam,
  expectNoBlockingViolations,
  joinTeam,
  signedInPage,
} from "./helpers/teams";

// Needs a Pusher-compatible server: playwright.config.ts points the app at a
// local Soketi container (see README "Running the tests").

// One login per test, so parallel sign-ins never create the same user at once.
const POSTER: TestUser = {
  login: "ziqi-live-poster-e2e",
  name: "Ziqi (Odie) Yang",
};
const WATCHER: TestUser = {
  login: "yunhong-live-watcher-e2e",
  name: "Yunhong Huang",
};
const RECONNECT_LEAD: TestUser = {
  login: "ziqi-live-reconnect-e2e",
  name: "Ziqi (Odie) Yang",
};

// The Pusher protocol's WebSocket URL: ws://<host>/app/<key>?protocol=7...
const PUSHER_SOCKET = /\/app\/[^/?]+\?/;

test.describe("Live dashboard", () => {
  test("posting a standup in one browser updates the dashboard in another without a reload", async ({
    page,
    browser,
  }) => {
    // Arrange: the watcher has the dashboard open
    await signInAsTestUser(page, POSTER);
    const teamId = await createTeam(page, "Live dashboard team");
    await addSprint(page, {
      teamId,
      name: "Sprint 1",
      startOffset: -3,
      endOffset: 3,
    });
    const watcher = await signedInPage(browser, WATCHER);
    await joinTeam({ lead: page, joiner: watcher, teamId, role: "MEMBER" });
    await watcher.goto(`/teams/${teamId}/dashboard`);
    await expect(watcher.getByText("Live", { exact: true })).toBeVisible({
      timeout: 10_000,
    });
    const posterCard = watcher.getByRole("article", {
      name: "Ziqi (Odie) Yang",
    });
    await expect(posterCard.locator("dl")).toHaveText(/Standups\s*0$/);
    // A full page load would drop this marker.
    await watcher.evaluate(() => Object.assign(window, { noReload: true }));

    // Act: the poster posts through the form in another browser context
    await page.goto(`/teams/${teamId}/standups`);
    const form = page.getByRole("region", { name: "Today's standup" });
    await form
      .getByLabel("Yesterday", { exact: true })
      .fill("Wrote the live tests.");
    await form.getByLabel("Today", { exact: true }).fill("Ship live updates.");
    await form.getByRole("button", { name: "Post standup" }).click();
    await expect(page.getByRole("status")).toHaveText("Standup posted.");

    // Assert: within 5 seconds, without a reload
    await expect(posterCard.locator("dl")).toHaveText(/Standups\s*1$/, {
      timeout: 5_000,
    });
    const feed = watcher.getByRole("region", { name: "Activity" });
    await expect(feed.getByRole("listitem").first()).toContainText(
      "Ziqi (Odie) Yang posted a standup"
    );
    await expect(watcher.getByRole("status")).toHaveText(
      "Ziqi (Odie) Yang posted a standup. Standups 1 of 3, on track."
    );
    expect(await watcher.evaluate(() => "noReload" in window)).toBe(true);
    await expectNoBlockingViolations(watcher);
  });

  test("shows Reconnecting… while the live connection is down, then Live again", async ({
    page,
  }) => {
    // Arrange: proxy the Pusher socket so the test can drop it
    let socket: WebSocketRoute | null = null;
    let isBlocked = false;
    await page.routeWebSocket(PUSHER_SOCKET, (route) => {
      if (isBlocked) {
        // Leave the new socket hanging, like a server that's unreachable.
        return;
      }
      route.connectToServer();
      socket = route;
    });
    await signInAsTestUser(page, RECONNECT_LEAD);
    const teamId = await createTeam(page, "Reconnect team");
    await addSprint(page, {
      teamId,
      name: "Sprint 1",
      startOffset: -3,
      endOffset: 3,
    });
    await page.goto(`/teams/${teamId}/dashboard`);
    const indicator = page.getByRole("banner");
    await expect(indicator.getByText("Live", { exact: true })).toBeVisible({
      timeout: 10_000,
    });

    // Act: the server drops the connection and refuses new ones
    isBlocked = true;
    await (socket as WebSocketRoute | null)?.close({
      code: 4200,
      reason: "Server restarting",
    });

    // Assert
    await expect(indicator.getByText("Reconnecting…")).toBeVisible();
    await expect(indicator.getByText("Live", { exact: true })).toHaveCount(0);
    await expectNoBlockingViolations(page);

    // Act: the server is back
    isBlocked = false;

    // Assert: pusher-js retries on its own
    await expect(indicator.getByText("Live", { exact: true })).toBeVisible({
      timeout: 30_000,
    });
  });
});
