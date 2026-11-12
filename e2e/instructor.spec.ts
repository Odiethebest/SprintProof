import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { signInAsTestUser, type TestUser } from "./helpers/auth";
import { COURSE_STAFF } from "./helpers/course-staff";
import {
  addSprint,
  createInviteToken,
  createTeam,
  expectNoBlockingViolations,
  joinTeam,
  signedInPage,
} from "./helpers/teams";

// AGENTS.md §2 User flows, flow 5: course staff create an instructor invite
// link (decision 006, #116), the instructor joins with it as INSTRUCTOR, reads
// the review page with the peer feedback, and exports it with the feedback.
// e2e/instructor-review.spec.ts and e2e/peer-feedback.spec.ts cover each
// step's details.

// One login per test, so parallel sign-ins never create the same user at once.
const LEAD: TestUser = {
  login: "ziqi-instructor-flow-lead-e2e",
  name: "Ziqi (Odie) Yang",
};
const MEMBER: TestUser = {
  login: "yunhong-instructor-flow-member-e2e",
  name: "Yunhong Huang",
};
const INSTRUCTOR: TestUser = {
  login: "ta-instructor-flow-e2e",
  name: "Course TA",
};

const LEAD_FEEDBACK =
  "Yunhong's webhook tests caught two signature bugs before review.";
const MEMBER_FEEDBACK =
  "Ziqi explains decisions well in PR descriptions. Some of my PRs waited a day for review.";

interface TeamMember {
  userId: string;
  githubLogin: string | null;
}

// Saves `author`'s partner feedback about `about` through the API, the way
// the retro's "Partner feedback" form sends it.
async function savePeerFeedback(
  author: Page,
  input: { teamId: string; sprintId: string; about: string; text: string }
): Promise<void> {
  const team = await author.request.get(`/api/v1/teams/${input.teamId}`);
  expect(team.status()).toBe(200);
  const { members } = (await team.json()) as { members: TeamMember[] };
  const recipient = members.find(
    (member) => member.githubLogin === input.about
  );
  const saved = await author.request.put(
    `/api/v1/teams/${input.teamId}/sprints/${input.sprintId}/peer-feedback/${recipient?.userId ?? ""}`,
    { data: { text: input.text } }
  );
  expect(saved.status()).toBe(200);
}

function teamNav(page: Page) {
  return page.getByRole("navigation", { name: "Team" });
}

test.describe("Instructor", () => {
  test("joins with an instructor link from course staff, reads the review page with peer feedback and exports it", async ({
    page,
    browser,
  }) => {
    // Arrange: Sprint 1 is running with its retro open, and both members
    // saved partner feedback
    await signInAsTestUser(page, LEAD);
    const teamId = await createTeam(page, "Instructor flow team");
    const sprintId = await addSprint(page, {
      teamId,
      name: "Sprint 1",
      startOffset: -3,
      endOffset: 3,
    });
    const member = await signedInPage(browser, MEMBER);
    await joinTeam({ lead: page, joiner: member, teamId, role: "MEMBER" });
    const opened = await page.request.post(
      `/api/v1/teams/${teamId}/sprints/${sprintId}/retro`
    );
    expect(opened.status()).toBe(201);
    await savePeerFeedback(page, {
      teamId,
      sprintId,
      about: MEMBER.login,
      text: LEAD_FEEDBACK,
    });
    await savePeerFeedback(member, {
      teamId,
      sprintId,
      about: LEAD.login,
      text: MEMBER_FEEDBACK,
    });

    // Act: course staff, who aren't on the team, create an instructor link
    const staff = await signedInPage(browser, COURSE_STAFF.instructorFlow);
    const token = await createInviteToken(staff, {
      teamId,
      role: "INSTRUCTOR",
    });

    // Act: the instructor opens it
    const instructor = await signedInPage(browser, INSTRUCTOR);
    await instructor.goto(`/invite/${token}`);

    // Assert
    await expect(
      instructor.getByRole("heading", {
        level: 1,
        name: "Join Instructor flow team",
      })
    ).toBeVisible();
    await expect(
      instructor.getByText(
        "You'll join as an instructor, with read-only access."
      )
    ).toBeVisible();
    await expectNoBlockingViolations(instructor);

    // Act
    await instructor.getByRole("button", { name: "Join team" }).click();

    // Assert: a read-only dashboard, without a summary of their own
    await expect(instructor).toHaveURL(
      new RegExp(`/teams/${teamId}/dashboard$`)
    );
    await expect(
      instructor.getByRole("heading", { level: 1, name: "Sprint 1" })
    ).toBeVisible();
    // Scoped to main: the invite page's "read-only access" can stay in the
    // DOM, hidden, after the navigation.
    await expect(
      instructor.getByRole("main").getByText("Read-only", { exact: true })
    ).toBeVisible();
    await expect(
      instructor.getByRole("region", { name: "Your requirements" })
    ).toHaveCount(0);

    // Act: open Review from the team navigation
    await teamNav(instructor).getByRole("link", { name: "Review" }).click();

    // Assert: the sprint read-only, one row per member
    await expect(instructor).toHaveURL(new RegExp(`/review/${teamId}$`));
    const main = instructor.getByRole("main");
    await expect(
      main.getByRole("heading", { level: 1, name: "Sprint 1 review" })
    ).toBeVisible();
    await expect(main.getByText("Read-only", { exact: true })).toBeVisible();
    const rows = main
      .getByRole("region", { name: "Requirements" })
      .getByRole("row");
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(1).getByRole("rowheader")).toContainText(LEAD.name);
    await expect(rows.nth(2).getByRole("rowheader")).toContainText(MEMBER.name);

    // Assert: the peer feedback card, one entry per author and teammate
    const feedbackCard = main.getByRole("region", { name: "Peer feedback" });
    await expect(
      feedbackCard.getByRole("article", {
        name: "Ziqi (Odie) Yang about Yunhong Huang",
      })
    ).toContainText(LEAD_FEEDBACK);
    await expect(
      feedbackCard.getByRole("article", {
        name: "Yunhong Huang about Ziqi (Odie) Yang",
      })
    ).toContainText(MEMBER_FEEDBACK);

    // Assert: no edit controls, only the export
    await expect(main.getByRole("textbox")).toHaveCount(0);
    await expect(main.getByRole("button")).toHaveCount(1);
    await expectNoBlockingViolations(instructor);

    // Act
    await main.getByRole("button", { name: "Export Markdown" }).click();
    const dialog = instructor.getByRole("dialog", {
      name: "sprint-1-summary.md",
    });

    // Assert: the instructor export has both members' feedback
    await expect(dialog).toContainText(
      "Instructor export. Includes peer feedback."
    );
    const preview = dialog.getByRole("region", { name: "Preview" });
    await expect(preview).toContainText(
      `### Ziqi (Odie) Yang about Yunhong Huang\n**Feedback:** ${LEAD_FEEDBACK}`
    );
    await expect(preview).toContainText(
      `### Yunhong Huang about Ziqi (Odie) Yang\n**Feedback:** ${MEMBER_FEEDBACK}`
    );
    await expectNoBlockingViolations(instructor);

    // Act: download it
    const downloading = instructor.waitForEvent("download");
    await dialog.getByRole("button", { name: "Download" }).click();
    const download = await downloading;

    // Assert: the file has the feedback too
    expect(download.suggestedFilename()).toBe("sprint-1-summary.md");
    const markdown = await readFile(await download.path(), "utf8");
    expect(markdown).toContain(`**Feedback:** ${LEAD_FEEDBACK}`);
    expect(markdown).toContain(`**Feedback:** ${MEMBER_FEEDBACK}`);
  });
});
