import { expect, test, type Page } from "@playwright/test";
import { signInAsTestUser, type TestUser } from "./helpers/auth";
import { COURSE_STAFF } from "./helpers/course-staff";
import {
  addSprint,
  createTeam,
  expectNoBlockingViolations,
  joinAsInstructor,
  joinTeam,
  signedInPage,
} from "./helpers/teams";

// One login per test, so parallel sign-ins never create the same user at once.
const LEAD: TestUser = {
  login: "ziqi-retro-lead-e2e",
  name: "Ziqi (Odie) Yang",
};
const MEMBER: TestUser = {
  login: "yunhong-retro-member-e2e",
  name: "Yunhong Huang",
};
const READ_ONLY_LEAD: TestUser = {
  login: "ziqi-retro-read-only-lead-e2e",
  name: "Ziqi (Odie) Yang",
};
const INSTRUCTOR: TestUser = { login: "ta-retro-e2e", name: "Course TA" };

// The "To improve" items, in the order the member adds them.
const SLOW_REVIEWS = "Some PRs still wait more than a day for review";
const SMALLER_PRS = "Split the dashboard work into smaller PRs";
const STANDUP_PLAN = "Write tomorrow's plan in the standup";
const MIGRATION_NAMES = "Agree on Prisma migration naming";
const CI_HELPED = "CI catches broken builds before review";

// A list item that holds the item's text and then its vote count.
function withVotes(text: string, votes: string): RegExp {
  return new RegExp(`^${text}\\s*${votes}$`);
}

function teamNav(page: Page) {
  return page.getByRole("navigation", { name: "Team" });
}

function column(page: Page, name: "Went well" | "To improve") {
  return page.getByRole("main").getByRole("region", { name });
}

function voteButton(page: Page, itemText: string) {
  return page
    .getByRole("main")
    .getByRole("button", { name: `Vote for ${itemText}`, exact: true });
}

async function addItem(
  page: Page,
  name: "Went well" | "To improve",
  text: string
): Promise<void> {
  const field = column(page, name).getByLabel(`Add item to ${name}`);
  await field.fill(text);
  await column(page, name)
    .getByRole("button", { name: `Add to ${name}`, exact: true })
    .click();
  await expect(
    column(page, name).getByText(text, { exact: true })
  ).toBeVisible();
  await expect(field).toHaveValue("");
}

async function toggleVote(page: Page, itemText: string, isPressed: boolean) {
  await voteButton(page, itemText).click();
  await expect(voteButton(page, itemText)).toHaveAttribute(
    "aria-pressed",
    String(isPressed)
  );
}

test.describe("Retro", () => {
  test("runs a retro from open to action items carried into the next sprint", async ({
    page,
    browser,
  }) => {
    // Arrange: Sprint 1 has ended, Sprint 2 is running
    await signInAsTestUser(page, LEAD);
    const teamId = await createTeam(page, "Retro team");
    const sprint1 = await addSprint(page, {
      teamId,
      name: "Sprint 1",
      startOffset: -10,
      endOffset: -4,
    });
    const sprint2 = await addSprint(page, {
      teamId,
      name: "Sprint 2",
      startOffset: -3,
      endOffset: 3,
    });
    const member = await signedInPage(browser, MEMBER);
    await joinTeam({ lead: page, joiner: member, teamId, role: "MEMBER" });

    // Act: open Retro from the team navigation, then pick Sprint 1
    await page.goto(`/teams/${teamId}/dashboard`);
    await teamNav(page).getByRole("link", { name: "Retro" }).click();

    // Assert: the current sprint's retro comes first
    await expect(page).toHaveURL(
      new RegExp(`/teams/${teamId}/sprints/${sprint2}/retro$`)
    );
    await expect(
      page.getByRole("heading", { level: 1, name: "Sprint 2 retro" })
    ).toBeVisible();
    await expect(
      teamNav(page).getByRole("link", { name: "Retro" })
    ).toHaveAttribute("aria-current", "page");

    // Act
    await page.getByLabel("Sprint", { exact: true }).selectOption(sprint1);

    // Assert
    await expect(page).toHaveURL(
      new RegExp(`/teams/${teamId}/sprints/${sprint1}/retro$`)
    );
    const main = page.getByRole("main");
    await expect(
      main.getByRole("heading", { level: 1, name: "Sprint 1 retro" })
    ).toBeVisible();
    await expect(
      main.getByText("Open the retro so the team can add items and vote.")
    ).toBeVisible();
    await expectNoBlockingViolations(page);

    // Act: the lead opens the retro
    await main.getByRole("button", { name: "Open retro" }).click();

    // Assert
    await expect(main.getByText("Open", { exact: true })).toBeVisible();
    await expect(main.getByText("3 votes each, 1 per item")).toBeVisible();
    await expect(main.getByText("3 of 3 votes left")).toBeVisible();

    // Act: the member adds one item that went well and four to improve
    await member.goto(`/teams/${teamId}/sprints/${sprint1}/retro`);
    await addItem(member, "Went well", CI_HELPED);
    for (const text of [
      SLOW_REVIEWS,
      SMALLER_PRS,
      STANDUP_PLAN,
      MIGRATION_NAMES,
    ]) {
      await addItem(member, "To improve", text);
    }

    // Assert: each column counts its items
    await expect(column(member, "Went well")).toContainText("1 item");
    await expect(column(member, "To improve")).toContainText("4 items");

    // Act: the member spends all 3 votes
    for (const text of [SLOW_REVIEWS, SMALLER_PRS, STANDUP_PLAN]) {
      await toggleVote(member, text, true);
    }

    // Assert: no votes left, so the 4th item's button explains why
    const memberMain = member.getByRole("main");
    await expect(memberMain.getByText("0 of 3 votes left")).toBeVisible();
    const noVotesLeft = voteButton(member, MIGRATION_NAMES);
    await expect(noVotesLeft).toHaveAttribute("aria-disabled", "true");
    await noVotesLeft.hover();
    await expect(
      member.getByRole("tooltip", { name: "No votes left" })
    ).toBeVisible();
    // Forced: Playwright waits for an aria-disabled button to be enabled.
    await noVotesLeft.click({ force: true });
    await expect(noVotesLeft).toHaveAttribute("aria-pressed", "false");
    await expect(noVotesLeft).toContainText("0");
    await expectNoBlockingViolations(member);

    // Act: take one vote back, then spend it on the 4th item
    await toggleVote(member, STANDUP_PLAN, false);
    await expect(memberMain.getByText("1 of 3 votes left")).toBeVisible();
    await expect(noVotesLeft).not.toHaveAttribute("aria-disabled", "true");
    await toggleVote(member, MIGRATION_NAMES, true);

    // Act: the lead votes too
    await page.reload();
    await toggleVote(page, SLOW_REVIEWS, true);
    await expect(main.getByText("2 of 3 votes left")).toBeVisible();

    // Assert: the preview lists the top 3, ties broken by the earliest
    const actionItems = main.getByRole("region", { name: "Action items" });
    const preview = actionItems.getByRole("list", { name: "For Sprint 2" });
    await expect(preview.getByRole("listitem")).toHaveText([
      withVotes(SLOW_REVIEWS, "2 votes"),
      withVotes(SMALLER_PRS, "1 vote"),
      withVotes(MIGRATION_NAMES, "1 vote"),
    ]);

    // Act: the lead closes the retro
    const closeButton = main.getByRole("button", { name: "Close retro" });
    await closeButton.click();

    // Assert: the dialog lists the items that become action items
    const dialog = page.getByRole("dialog", {
      name: "Close the Sprint 1 retro?",
    });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("listitem")).toHaveText([
      SLOW_REVIEWS,
      SMALLER_PRS,
      MIGRATION_NAMES,
    ]);
    await expectNoBlockingViolations(page);

    // Act
    await dialog.getByRole("button", { name: "Close retro" }).click();

    // Assert: closed and read-only
    await expect(dialog).toBeHidden();
    await expect(main.getByText("Closed", { exact: true })).toBeVisible();
    await expect(main.getByRole("textbox")).toHaveCount(0);
    await expect(column(page, "To improve").getByRole("button")).toHaveCount(0);
    await expect(main.getByRole("button", { name: "Close retro" })).toHaveCount(
      0
    );
    await expect(
      actionItems
        .getByRole("list", { name: "For Sprint 2" })
        .getByRole("listitem")
    ).toHaveText([
      withVotes(SLOW_REVIEWS, "2 votes"),
      withVotes(SMALLER_PRS, "1 vote"),
      withVotes(MIGRATION_NAMES, "1 vote"),
    ]);
    await expectNoBlockingViolations(page);

    // Act: the member opens Sprint 2's retro and checks off an action item
    await member.goto(`/teams/${teamId}/sprints/${sprint2}/retro`);
    const carried = member
      .getByRole("main")
      .getByRole("region", { name: "Action items" })
      .getByRole("list", { name: "Carried into Sprint 2" });
    await expect(carried.getByRole("checkbox")).toHaveCount(3);
    await expect(member.getByText("From the Sprint 1 retro")).toBeVisible();
    const slowReviews = carried.getByRole("checkbox", { name: SLOW_REVIEWS });
    await expect(slowReviews).not.toBeChecked();
    await slowReviews.check();

    // Assert: saved, so it stays checked after a reload
    await expect(slowReviews).toBeChecked();
    await expect(member.locator('[aria-live="polite"]')).toHaveText(
      "Marked done."
    );
    await member.reload();
    await expect(
      carried.getByRole("checkbox", { name: SLOW_REVIEWS })
    ).toBeChecked();
    await expect(
      carried.getByRole("checkbox", { name: SMALLER_PRS })
    ).not.toBeChecked();
    await expectNoBlockingViolations(member);

    // Act: the lead reviews Sprint 1
    await page.goto(`/review/${teamId}?sprint=${sprint1}`);

    // Assert: the retro card shows both columns with votes and the action items
    const retroCard = page
      .getByRole("main")
      .getByRole("region", { name: "Retro", exact: true });
    await expect(retroCard.getByText("Closed", { exact: true })).toBeVisible();
    await expect(retroCard).toContainText(CI_HELPED);
    await expect(retroCard).toContainText(SLOW_REVIEWS);
    await expect(
      retroCard
        .getByRole("list", { name: "Action items for Sprint 2" })
        .getByRole("listitem")
    ).toHaveCount(3);
    await expect(
      page.getByText(
        "Peer feedback is left out of this page and of the export.",
        {
          exact: true,
        }
      )
    ).toBeVisible();
    await expectNoBlockingViolations(page);

    // Act: open the export
    await page.getByRole("button", { name: "Export Markdown" }).click();

    // Assert: the export has the retro, with the done item checked
    const exportPreview = page
      .getByRole("dialog", { name: "sprint-1-summary.md" })
      .getByRole("region", { name: "Preview" });
    await expect(exportPreview).toContainText("## Retro");
    await expect(exportPreview).toContainText(`| ${SLOW_REVIEWS} | 2 |`);
    await expect(exportPreview).toContainText(`- [x] ${SLOW_REVIEWS}`);
    await expect(exportPreview).toContainText(`- [ ] ${SMALLER_PRS}`);
  });

  test("shows an instructor the retro read-only", async ({ page, browser }) => {
    // Arrange: an open retro with one item and one vote
    await signInAsTestUser(page, READ_ONLY_LEAD);
    const teamId = await createTeam(page, "Read-only retro team");
    const sprintId = await addSprint(page, {
      teamId,
      name: "Sprint 1",
      startOffset: -3,
      endOffset: 3,
    });
    const retroPath = `/api/v1/teams/${teamId}/sprints/${sprintId}/retro`;
    expect((await page.request.post(retroPath)).status()).toBe(201);
    const added = await page.request.post(`${retroPath}/items`, {
      data: { column: "WENT_WELL", text: CI_HELPED },
    });
    expect(added.status()).toBe(201);
    const { id: itemId } = (await added.json()) as { id: string };
    expect(
      (await page.request.put(`${retroPath}/items/${itemId}/vote`)).status()
    ).toBe(200);
    // Instructor links come from course staff (decision 006, #116).
    const staff = await signedInPage(browser, COURSE_STAFF.retro);
    const instructor = await signedInPage(browser, INSTRUCTOR);
    await joinAsInstructor({ staff, joiner: instructor, teamId });

    // Act
    await instructor.goto(`/teams/${teamId}/dashboard`);
    await teamNav(instructor).getByRole("link", { name: "Retro" }).click();

    // Assert: the items and their votes, without any control to change them
    await expect(
      instructor.getByRole("heading", { level: 1, name: "Sprint 1 retro" })
    ).toBeVisible();
    const wentWell = column(instructor, "Went well");
    await expect(wentWell).toContainText(CI_HELPED);
    await expect(wentWell).toContainText("1 vote");
    const main = instructor.getByRole("main");
    await expect(main.getByRole("textbox")).toHaveCount(0);
    await expect(main.getByRole("button")).toHaveCount(0);
    await expect(main.getByText(/votes left$/)).toHaveCount(0);
    await expectNoBlockingViolations(instructor);
  });
});
