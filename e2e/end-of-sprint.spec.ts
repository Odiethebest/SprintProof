import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { signInAsTestUser, type TestUser } from "./helpers/auth";
import {
  addSprint,
  createTeam,
  expectNoBlockingViolations,
  joinTeam,
  signedInPage,
} from "./helpers/teams";

// AGENTS.md §2 User flows, flow 4: the lead opens the retro, both members add
// items, vote and save partner feedback, the lead closes it, the top 3 "To
// improve" items carry into the next sprint, and the lead exports the team
// summary without peer feedback. e2e/retro.spec.ts and
// e2e/peer-feedback.spec.ts cover each step's details.

// One login per test, so parallel sign-ins never create the same user at once.
const LEAD: TestUser = {
  login: "ziqi-end-of-sprint-lead-e2e",
  name: "Ziqi (Odie) Yang",
};
const MEMBER: TestUser = {
  login: "yunhong-end-of-sprint-member-e2e",
  name: "Yunhong Huang",
};

const CI_HELPED = "CI catches broken builds before review";
const PAIRING = "Pairing on the webhook receiver";
// "To improve", in the order they're added: the lead's first.
const SLOW_REVIEWS = "Some PRs still wait more than a day for review";
const SMALLER_PRS = "Split the dashboard work into smaller PRs";
const STANDUP_PLAN = "Write tomorrow's plan in the standup";
const MIGRATION_NAMES = "Agree on Prisma migration naming";

const LEAD_FEEDBACK =
  "Yunhong's webhook tests caught two signature bugs before review.";
const MEMBER_FEEDBACK =
  "Ziqi explains decisions well in PR descriptions. Some of my PRs waited a day for review.";

// An action item: its text, then its vote count.
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

function votesLeft(page: Page, left: number) {
  return page.getByRole("main").getByText(`${left} of 3 votes left`);
}

async function addItem(
  page: Page,
  name: "Went well" | "To improve",
  text: string
): Promise<void> {
  await column(page, name).getByLabel(`Add item to ${name}`).fill(text);
  await column(page, name)
    .getByRole("button", { name: `Add to ${name}`, exact: true })
    .click();
  await expect(
    column(page, name).getByText(text, { exact: true })
  ).toBeVisible();
}

async function toggleVote(page: Page, itemText: string, isPressed: boolean) {
  await voteButton(page, itemText).click();
  await expect(voteButton(page, itemText)).toHaveAttribute(
    "aria-pressed",
    String(isPressed)
  );
}

async function saveFeedback(page: Page, about: string, text: string) {
  const card = page
    .getByRole("main")
    .getByRole("region", { name: "Partner feedback" });
  await card.getByLabel(`Feedback for ${about}`).fill(text);
  await card
    .getByRole("button", { name: `Save feedback for ${about}`, exact: true })
    .click();
  await expect(page.locator('[aria-live="polite"]')).toHaveText(
    `Feedback for ${about} saved.`
  );
}

test.describe("End of sprint", () => {
  test("runs the Sprint 1 retro, carries its action items into Sprint 2 and exports the team summary without peer feedback", async ({
    page,
    browser,
  }) => {
    // Arrange: Sprint 1 has ended, Sprint 2 is running, two members
    await signInAsTestUser(page, LEAD);
    const teamId = await createTeam(page, "End of sprint team");
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
    const sprint1Retro = `/teams/${teamId}/sprints/${sprint1}/retro`;

    // Act: the lead opens the Sprint 1 retro
    await page.goto(sprint1Retro);
    await page
      .getByRole("main")
      .getByRole("button", { name: "Open retro" })
      .click();

    // Assert
    await expect(
      page.getByRole("main").getByText("Open", { exact: true })
    ).toBeVisible();
    await expect(votesLeft(page, 3)).toBeVisible();

    // Act: both members add items to both columns
    await addItem(page, "Went well", CI_HELPED);
    await addItem(page, "To improve", SLOW_REVIEWS);
    await member.goto(sprint1Retro);
    await addItem(member, "Went well", PAIRING);
    for (const text of [SMALLER_PRS, STANDUP_PLAN, MIGRATION_NAMES]) {
      await addItem(member, "To improve", text);
    }

    // Assert
    await expect(column(member, "Went well")).toContainText("2 items");
    await expect(column(member, "To improve")).toContainText("4 items");

    // Act: the member spends all 3 votes
    for (const text of [SLOW_REVIEWS, SMALLER_PRS, MIGRATION_NAMES]) {
      await toggleVote(member, text, true);
    }

    // Assert: no votes left for the 4th item
    await expect(votesLeft(member, 0)).toBeVisible();
    const noVotesLeft = voteButton(member, STANDUP_PLAN);
    await expect(noVotesLeft).toHaveAttribute("aria-disabled", "true");
    await noVotesLeft.hover();
    await expect(
      member.getByRole("tooltip", { name: "No votes left" })
    ).toBeVisible();
    await expectNoBlockingViolations(member);

    // Act: the lead votes for an item, then presses it again
    await page.reload();
    await toggleVote(page, SLOW_REVIEWS, true);
    await expect(voteButton(page, SLOW_REVIEWS)).toHaveAccessibleDescription(
      "2 votes"
    );
    await toggleVote(page, SLOW_REVIEWS, false);

    // Assert: 1 vote per item, so the second press takes it back
    await expect(voteButton(page, SLOW_REVIEWS)).toHaveAccessibleDescription(
      "1 vote"
    );
    await expect(votesLeft(page, 3)).toBeVisible();

    // Act: the lead spends all 3 votes
    for (const text of [SLOW_REVIEWS, MIGRATION_NAMES, CI_HELPED]) {
      await toggleVote(page, text, true);
    }

    // Assert: the preview has the top 3 "To improve" items by votes, ties
    // broken by the earliest
    await expect(votesLeft(page, 0)).toBeVisible();
    const actionItems = page
      .getByRole("main")
      .getByRole("region", { name: "Action items" });
    await expect(
      actionItems
        .getByRole("list", { name: "For Sprint 2" })
        .getByRole("listitem")
    ).toHaveText([
      withVotes(SLOW_REVIEWS, "2 votes"),
      withVotes(MIGRATION_NAMES, "2 votes"),
      withVotes(SMALLER_PRS, "1 vote"),
    ]);

    // Act: each member saves partner feedback about the other
    await saveFeedback(page, MEMBER.name, LEAD_FEEDBACK);
    await saveFeedback(member, LEAD.name, MEMBER_FEEDBACK);

    // Act: the lead closes the retro
    await page
      .getByRole("main")
      .getByRole("button", { name: "Close retro" })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "Close the Sprint 1 retro?",
    });

    // Assert: the dialog lists the items that become action items
    await expect(dialog.getByRole("listitem")).toHaveText([
      SLOW_REVIEWS,
      MIGRATION_NAMES,
      SMALLER_PRS,
    ]);
    await expectNoBlockingViolations(page);

    // Act
    await dialog.getByRole("button", { name: "Close retro" }).click();

    // Assert: closed, with the 3 action items for Sprint 2
    await expect(dialog).toBeHidden();
    await expect(
      page.getByRole("main").getByText("Closed", { exact: true })
    ).toBeVisible();
    await expect(page.getByRole("main").getByRole("textbox")).toHaveCount(0);
    await expect(
      actionItems
        .getByRole("list", { name: "For Sprint 2" })
        .getByRole("listitem")
    ).toHaveCount(3);

    // Act: the member opens Retro, which shows the current sprint, Sprint 2
    await member.goto(`/teams/${teamId}/dashboard`);
    await teamNav(member).getByRole("link", { name: "Retro" }).click();

    // Assert: the action items carried into Sprint 2
    await expect(member).toHaveURL(
      new RegExp(`/teams/${teamId}/sprints/${sprint2}/retro$`)
    );
    const carried = member
      .getByRole("main")
      .getByRole("region", { name: "Action items" })
      .getByRole("list", { name: "Carried into Sprint 2" });
    await expect(carried.getByRole("checkbox")).toHaveCount(3);
    for (const text of [SLOW_REVIEWS, MIGRATION_NAMES, SMALLER_PRS]) {
      await expect(carried.getByRole("checkbox", { name: text })).toBeVisible();
    }
    await expect(member.getByText("From the Sprint 1 retro")).toBeVisible();
    await expectNoBlockingViolations(member);

    // Act: the lead opens the Sprint 1 review and its export
    await page.goto(`/review/${teamId}?sprint=${sprint1}`);
    const main = page.getByRole("main");
    await expect(
      main.getByRole("heading", { level: 1, name: "Sprint 1 review" })
    ).toBeVisible();

    // Assert: no peer feedback on the page
    await expect(
      main.getByRole("region", { name: "Peer feedback" })
    ).toHaveCount(0);
    await expect(
      main.getByText(
        "Peer feedback is left out of this page and of the export.",
        { exact: true }
      )
    ).toBeVisible();
    await expect(
      main
        .getByRole("region", { name: "Retro", exact: true })
        .getByRole("list", { name: "Action items for Sprint 2" })
        .getByRole("listitem")
    ).toHaveCount(3);
    await expectNoBlockingViolations(page);

    // Act
    await main.getByRole("button", { name: "Export Markdown" }).click();
    const exportDialog = page.getByRole("dialog", {
      name: "sprint-1-summary.md",
    });

    // Assert: the team export has the retro and leaves out peer feedback
    await expect(exportDialog).toContainText(
      "Team export. Peer feedback is left out."
    );
    const preview = exportDialog.getByRole("region", { name: "Preview" });
    await expect(preview).toContainText(`| ${SLOW_REVIEWS} | 2 |`);
    await expect(preview).toContainText(
      [
        "### Action items for Sprint 2",
        `- [ ] ${SLOW_REVIEWS}`,
        `- [ ] ${MIGRATION_NAMES}`,
        `- [ ] ${SMALLER_PRS}`,
      ].join("\n")
    );
    await expect(preview).toContainText(
      "## Peer feedback\nTeam exports leave out peer feedback."
    );
    await expectNoBlockingViolations(page);

    // Act: download it
    const downloading = page.waitForEvent("download");
    await exportDialog.getByRole("button", { name: "Download" }).click();
    const download = await downloading;

    // Assert: the file has the action items and neither member's feedback
    expect(download.suggestedFilename()).toBe("sprint-1-summary.md");
    const markdown = await readFile(await download.path(), "utf8");
    expect(markdown).toContain(`- [ ] ${SLOW_REVIEWS}`);
    expect(markdown).not.toContain(LEAD_FEEDBACK);
    expect(markdown).not.toContain(MEMBER_FEEDBACK);
  });
});
