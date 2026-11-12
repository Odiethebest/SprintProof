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
  login: "ziqi-feedback-lead-e2e",
  name: "Ziqi (Odie) Yang",
};
const MEMBER: TestUser = {
  login: "yunhong-feedback-member-e2e",
  name: "Yunhong Huang",
};
const INSTRUCTOR: TestUser = { login: "ta-feedback-e2e", name: "Course TA" };
const ERROR_LEAD: TestUser = {
  login: "ziqi-feedback-error-lead-e2e",
  name: "Ziqi (Odie) Yang",
};
const ERROR_MEMBER: TestUser = {
  login: "yunhong-feedback-error-member-e2e",
  name: "Yunhong Huang",
};

const FIRST_DRAFT = "Ziqi explains decisions well in PR descriptions.";
const FEEDBACK =
  "Ziqi explains decisions well in PR descriptions. A few of my PRs waited more than a day for review.";
// "Saved Nov 12": the day, in the team's timezone (DESIGN.md §9).
const SAVED_ON = /^Saved [A-Z][a-z]{2} \d{1,2}$/;

function partnerFeedback(page: Page) {
  return page
    .getByRole("main")
    .getByRole("region", { name: "Partner feedback" });
}

async function saveFeedback(page: Page, about: string, text: string) {
  const card = partnerFeedback(page);
  await card.getByLabel(`Feedback for ${about}`).fill(text);
  await card
    .getByRole("button", { name: `Save feedback for ${about}`, exact: true })
    .click();
  await expect(page.locator('[aria-live="polite"]')).toHaveText(
    `Feedback for ${about} saved.`
  );
}

test.describe("Peer feedback", () => {
  test("keeps a member's partner feedback for instructors only", async ({
    page,
    browser,
  }) => {
    // Arrange: Sprint 1 is running with its retro open; Sprint 2 follows it
    await signInAsTestUser(page, LEAD);
    const teamId = await createTeam(page, "Feedback team");
    const sprint1 = await addSprint(page, {
      teamId,
      name: "Sprint 1",
      startOffset: -3,
      endOffset: 3,
    });
    await addSprint(page, {
      teamId,
      name: "Sprint 2",
      startOffset: 4,
      endOffset: 10,
    });
    const member = await signedInPage(browser, MEMBER);
    await joinTeam({ lead: page, joiner: member, teamId, role: "MEMBER" });
    // Instructor links come from course staff (decision 006, #116).
    const staff = await signedInPage(browser, COURSE_STAFF.peerFeedback);
    const instructor = await signedInPage(browser, INSTRUCTOR);
    await joinAsInstructor({ staff, joiner: instructor, teamId });
    const retroPath = `/teams/${teamId}/sprints/${sprint1}/retro`;
    expect((await page.request.post(`/api/v1${retroPath}`)).status()).toBe(201);

    // Act: the member opens the retro
    await member.goto(retroPath);

    // Assert: one field, about the lead, labeled as for instructors only
    const card = partnerFeedback(member);
    await expect(
      card.getByText(
        "Visible to instructors only. You can edit it until the retro closes.",
        { exact: true }
      )
    ).toBeVisible();
    await expect(card.getByRole("textbox")).toHaveCount(1);
    await expect(card.getByLabel("Feedback for Ziqi (Odie) Yang")).toHaveValue(
      ""
    );
    await expect(
      card.getByText("Not saved yet", { exact: true })
    ).toBeVisible();
    await expect(card.getByText("0 / 1000", { exact: true })).toBeVisible();
    await expectNoBlockingViolations(member);

    // Act: save a first draft, then reload
    await saveFeedback(member, "Ziqi (Odie) Yang", FIRST_DRAFT);
    await expect(card.getByText(SAVED_ON)).toBeVisible();
    await member.reload();

    // Assert: the author reads their own feedback back to edit it
    await expect(card.getByLabel("Feedback for Ziqi (Odie) Yang")).toHaveValue(
      FIRST_DRAFT
    );
    await expect(card.getByText(SAVED_ON)).toBeVisible();

    // Act: edit it while the retro is open
    await saveFeedback(member, "Ziqi (Odie) Yang", FEEDBACK);
    await member.reload();

    // Assert
    await expect(card.getByLabel("Feedback for Ziqi (Odie) Yang")).toHaveValue(
      FEEDBACK
    );

    // Act: the lead opens the same retro
    await page.goto(retroPath);

    // Assert: the lead has their own empty field and never the member's text
    await expect(
      partnerFeedback(page).getByLabel("Feedback for Yunhong Huang")
    ).toHaveValue("");
    await expect(page.getByText(FEEDBACK)).toHaveCount(0);
    const leadList = await page.request.get(
      `/api/v1/teams/${teamId}/sprints/${sprint1}/peer-feedback`
    );
    expect(leadList.status()).toBe(404);
    expect(await leadList.text()).not.toContain(FIRST_DRAFT);

    // Act: the lead opens the review page and its export
    await page.goto(`/review/${teamId}?sprint=${sprint1}`);
    const leadMain = page.getByRole("main");
    await expect(
      leadMain.getByRole("heading", { level: 1, name: "Sprint 1 review" })
    ).toBeVisible();
    await leadMain.getByRole("button", { name: "Export Markdown" }).click();

    // Assert: no peer feedback on the page or in the export
    await expect(
      leadMain.getByRole("region", { name: "Peer feedback" })
    ).toHaveCount(0);
    await expect(
      leadMain.getByText(
        "Peer feedback is left out of this page and of the export.",
        { exact: true }
      )
    ).toBeVisible();
    const leadDialog = page.getByRole("dialog", {
      name: "sprint-1-summary.md",
    });
    await expect(leadDialog).toContainText(
      "Team export. Peer feedback is left out."
    );
    const leadPreview = leadDialog.getByRole("region", { name: "Preview" });
    await expect(leadPreview).toContainText(
      "## Peer feedback\nTeam exports leave out peer feedback."
    );
    await expect(leadPreview).not.toContainText(FIRST_DRAFT);
    await expect(page.getByText(FIRST_DRAFT)).toHaveCount(0);

    // Act: the instructor opens the review page
    await instructor.goto(`/review/${teamId}?sprint=${sprint1}`);

    // Assert: one entry per author and teammate
    const feedbackCard = instructor
      .getByRole("main")
      .getByRole("region", { name: "Peer feedback" });
    const aboutLead = feedbackCard.getByRole("article", {
      name: "Yunhong Huang about Ziqi (Odie) Yang",
    });
    await expect(aboutLead).toContainText(FEEDBACK);
    await expect(
      aboutLead.getByText(/^Updated [A-Z][a-z]{2} \d{1,2}$/)
    ).toBeVisible();
    await expect(
      feedbackCard
        .getByRole("article", { name: "Ziqi (Odie) Yang about Yunhong Huang" })
        .getByText("Not submitted yet.", { exact: true })
    ).toBeVisible();
    await expectNoBlockingViolations(instructor);

    // Act: the instructor opens the export
    await instructor
      .getByRole("main")
      .getByRole("button", { name: "Export Markdown" })
      .click();

    // Assert: the instructor's export has the feedback
    const dialog = instructor.getByRole("dialog", {
      name: "sprint-1-summary.md",
    });
    await expect(dialog).toContainText(
      "Instructor export. Includes peer feedback."
    );
    await expect(dialog.getByRole("region", { name: "Preview" })).toContainText(
      `### Yunhong Huang about Ziqi (Odie) Yang\n**Feedback:** ${FEEDBACK}`
    );
    await expectNoBlockingViolations(instructor);

    // Assert: instructors read feedback on the review page, not in the retro
    await instructor.goto(retroPath);
    await expect(
      instructor.getByRole("heading", { level: 1, name: "Sprint 1 retro" })
    ).toBeVisible();
    await expect(partnerFeedback(instructor)).toHaveCount(0);
    await expect(instructor.getByText(FEEDBACK)).toHaveCount(0);

    // Act: the lead closes the retro, and the member opens it again
    const closed = await page.request.patch(`/api/v1${retroPath}`, {
      data: { status: "CLOSED" },
    });
    expect(closed.status()).toBe(200);
    await member.goto(retroPath);

    // Assert: the feedback is read-only now
    const closedCard = partnerFeedback(member);
    await expect(
      closedCard.getByText(
        "Visible to instructors only. The retro is closed, so it can't be edited.",
        { exact: true }
      )
    ).toBeVisible();
    await expect(closedCard).toContainText(FEEDBACK);
    await expect(closedCard.getByRole("textbox")).toHaveCount(0);
    await expect(closedCard.getByRole("button")).toHaveCount(0);
    await expectNoBlockingViolations(member);
  });

  test("shows an error under the field and keeps the text when saving fails", async ({
    page,
    browser,
  }) => {
    // Arrange: an open retro on a team of two
    await signInAsTestUser(page, ERROR_LEAD);
    const teamId = await createTeam(page, "Feedback error team");
    const sprintId = await addSprint(page, {
      teamId,
      name: "Sprint 1",
      startOffset: -3,
      endOffset: 3,
    });
    const member = await signedInPage(browser, ERROR_MEMBER);
    await joinTeam({ lead: page, joiner: member, teamId, role: "MEMBER" });
    const retroPath = `/teams/${teamId}/sprints/${sprintId}/retro`;
    expect((await page.request.post(`/api/v1${retroPath}`)).status()).toBe(201);
    await member.goto(retroPath);
    const card = partnerFeedback(member);
    const field = card.getByLabel("Feedback for Ziqi (Odie) Yang");
    const save = card.getByRole("button", {
      name: "Save feedback for Ziqi (Odie) Yang",
      exact: true,
    });

    // Act: save an empty field
    await save.click();

    // Assert: the error is under the field and linked to it
    await expect(field).toHaveAttribute("aria-invalid", "true");
    await expect(field).toHaveAccessibleDescription(
      /Write your feedback first\./
    );
    await expect(field).toBeFocused();

    // Act: the server refuses the save (here, a network failure)
    await member.route(
      `**/api/v1/teams/${teamId}/sprints/${sprintId}/peer-feedback/**`,
      (route) => route.abort()
    );
    await field.fill(FIRST_DRAFT);
    await save.click();

    // Assert: the text stays, with the error under it
    await expect(field).toHaveAccessibleDescription(
      /Couldn't reach SprintProof\./
    );
    await expect(field).toHaveValue(FIRST_DRAFT);
    await expect(
      card.getByText("Not saved yet", { exact: true })
    ).toBeVisible();
    await expectNoBlockingViolations(member);
  });
});
