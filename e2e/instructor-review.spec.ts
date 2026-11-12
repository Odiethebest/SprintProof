import { readFile } from "node:fs/promises";
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
const INSTRUCTOR_LEAD: TestUser = {
  login: "ziqi-review-instructor-lead-e2e",
  name: "Ziqi (Odie) Yang",
};
const INSTRUCTOR: TestUser = { login: "ta-review-e2e", name: "Course TA" };
const LEAD: TestUser = {
  login: "ziqi-review-lead-e2e",
  name: "Ziqi (Odie) Yang",
};
const MEMBER_LEAD: TestUser = {
  login: "ziqi-review-member-lead-e2e",
  name: "Ziqi (Odie) Yang",
};
const MEMBER: TestUser = {
  login: "yunhong-review-member-e2e",
  name: "Yunhong Huang",
};

const NOT_RECORDED =
  "Retro items, action items and peer feedback aren't recorded in SprintProof yet.";

// A team with a running Sprint 1 and one standup from its lead.
async function createTeamWithStandup(lead: Page): Promise<string> {
  const teamId = await createTeam(lead, "Review team");
  await addSprint(lead, {
    teamId,
    name: "Sprint 1",
    startOffset: -3,
    endOffset: 3,
  });
  const posted = await lead.request.post(`/api/v1/teams/${teamId}/standups`, {
    data: {
      yesterday: "Wrote the review page tests.",
      today: "Build the Markdown export.",
    },
  });
  expect(posted.status()).toBe(201);
  return teamId;
}

function teamNav(page: Page) {
  return page.getByRole("navigation", { name: "Team" });
}

test.describe("Instructor review", () => {
  test("shows an instructor the sprint read-only and exports it as Markdown", async ({
    page,
    browser,
  }) => {
    // Arrange
    await signInAsTestUser(page, INSTRUCTOR_LEAD);
    const teamId = await createTeamWithStandup(page);
    const staff = await signedInPage(browser, COURSE_STAFF.review);
    const instructor = await signedInPage(browser, INSTRUCTOR);
    await joinAsInstructor({ staff, joiner: instructor, teamId });
    await instructor
      .context()
      .grantPermissions(["clipboard-read", "clipboard-write"]);

    // Act: open Review from the team navigation
    await instructor.goto(`/teams/${teamId}/dashboard`);
    await teamNav(instructor).getByRole("link", { name: "Review" }).click();

    // Assert: header
    await expect(instructor).toHaveURL(new RegExp(`/review/${teamId}$`));
    await expect(
      instructor.getByRole("heading", { level: 1, name: "Sprint 1 review" })
    ).toBeVisible();
    await expect(
      teamNav(instructor).getByRole("link", { name: "Review" })
    ).toHaveAttribute("aria-current", "page");
    const main = instructor.getByRole("main");
    await expect(main.getByText("Read-only")).toBeVisible();
    await expect(
      // Exact: the export preview holds the same words.
      main.getByText("3 standups and 5 PR reviews per person", { exact: true })
    ).toBeVisible();

    // Assert: one row per member, without the instructor
    const requirements = main.getByRole("region", { name: "Requirements" });
    await expect(requirements.getByText(/^Counts as of /)).toBeVisible();
    const rows = requirements.getByRole("row");
    await expect(rows).toHaveCount(2);
    const leadRow = rows.nth(1);
    await expect(leadRow.getByRole("rowheader")).toContainText(
      "Ziqi (Odie) Yang"
    );
    await expect(leadRow.getByRole("rowheader")).toContainText(
      `@${INSTRUCTOR_LEAD.login}`
    );
    const [standupCell, reviewCell] = [
      leadRow.getByRole("cell").nth(0),
      leadRow.getByRole("cell").nth(1),
    ];
    await expect(standupCell).toContainText("1 of 3");
    await expect(standupCell).toContainText("On track");
    await expect(reviewCell).toContainText("0 of 5");

    // Assert: standups by day, and the retro card
    const standups = main.getByRole("region", { name: "Standups" });
    await expect(standups.getByRole("heading", { level: 3 })).toHaveCount(1);
    await expect(standups).toContainText("Build the Markdown export.");
    await expect(main.getByText(NOT_RECORDED, { exact: true })).toBeVisible();

    // Assert: no edit controls, only the export
    await expect(main.getByRole("textbox")).toHaveCount(0);
    await expect(main.locator("form")).toHaveCount(0);
    await expect(main.getByRole("button")).toHaveCount(1);
    await expectNoBlockingViolations(instructor);

    // Act: open the export
    const exportButton = main.getByRole("button", { name: "Export Markdown" });
    await exportButton.click();

    // Assert: the dialog names the file and says what it contains
    const dialog = instructor.getByRole("dialog", {
      name: "sprint-1-summary.md",
    });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(
      "Instructor export. Peer feedback isn't recorded in SprintProof yet."
    );
    const preview = dialog.getByRole("region", { name: "Preview" });
    await expect(preview).toContainText("# Sprint 1 summary");
    await expect(preview).toContainText(
      `| Ziqi (Odie) Yang | @${INSTRUCTOR_LEAD.login} | 1 / 3 · On track | 0 / 5 · On track | 0 | 0 |`
    );
    await expect(preview).toContainText(
      "**Today:** Build the Markdown export."
    );
    await expect(preview).toContainText(NOT_RECORDED);
    await expectNoBlockingViolations(instructor);
    const markdown = await preview.locator("pre").textContent();

    // Act: copy, then download
    await dialog.getByRole("button", { name: "Copy Markdown" }).click();
    await expect(dialog.getByRole("button", { name: "Copied" })).toBeVisible();
    const copied = await instructor.evaluate(() =>
      navigator.clipboard.readText()
    );
    const downloading = instructor.waitForEvent("download");
    await dialog.getByRole("button", { name: "Download" }).click();
    const download = await downloading;

    // Assert: the clipboard and the file hold the previewed Markdown
    expect(copied).toBe(markdown);
    expect(download.suggestedFilename()).toBe("sprint-1-summary.md");
    expect(await readFile(await download.path(), "utf8")).toBe(markdown);

    // Act: close the dialog
    await dialog.getByRole("button", { name: "Close" }).click();

    // Assert: focus is back on the trigger
    await expect(dialog).toBeHidden();
    await expect(exportButton).toBeFocused();
  });

  test("shows a lead that peer feedback is left out of the page and the export", async ({
    page,
  }) => {
    // Arrange
    await signInAsTestUser(page, LEAD);
    const teamId = await createTeamWithStandup(page);

    // Act
    await page.goto(`/review/${teamId}`);

    // Assert
    await expect(
      page.getByRole("heading", { level: 1, name: "Sprint 1 review" })
    ).toBeVisible();
    await expect(
      teamNav(page).getByRole("link", { name: "Review" })
    ).toHaveAttribute("aria-current", "page");
    const main = page.getByRole("main");
    await expect(main.getByText(NOT_RECORDED, { exact: true })).toBeVisible();
    await expect(
      main.getByText(
        "Peer feedback is left out of this page and of the export.",
        { exact: true }
      )
    ).toBeVisible();
    await expectNoBlockingViolations(page);

    // Act: open the export, then close it with Escape
    const exportButton = main.getByRole("button", { name: "Export Markdown" });
    await exportButton.click();
    const dialog = page.getByRole("dialog", { name: "sprint-1-summary.md" });

    // Assert
    await expect(dialog).toContainText(
      "Team export. Peer feedback is left out."
    );
    await expect(dialog.getByRole("region", { name: "Preview" })).toContainText(
      "Team exports leave out peer feedback."
    );
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(exportButton).toBeFocused();
  });

  test("refuses a member, who gets no Review link", async ({
    page,
    browser,
  }) => {
    // Arrange
    await signInAsTestUser(page, MEMBER_LEAD);
    const teamId = await createTeamWithStandup(page);
    const member = await signedInPage(browser, MEMBER);
    await joinTeam({ lead: page, joiner: member, teamId, role: "MEMBER" });

    // Act
    await member.goto(`/teams/${teamId}/dashboard`);

    // Assert
    await expect(
      member.getByRole("heading", { level: 1, name: "Sprint 1" })
    ).toBeVisible();
    await expect(
      teamNav(member).getByRole("link", { name: "Review" })
    ).toHaveCount(0);

    // Act
    await member.goto(`/review/${teamId}`);

    // Assert: the same page as a team that doesn't exist, whether that's
    // Next's default ("404") or the app's own ("Page not found", #100)
    await expect(
      member.getByRole("heading", {
        level: 1,
        name: /^(404|Page not found)$/,
      })
    ).toBeVisible();
    await expect(member.getByText("Sprint 1 review")).toHaveCount(0);
    await expect(member.getByText("Build the Markdown export.")).toHaveCount(0);
  });
});
