import { test, expect, type Page } from "@playwright/test";
import { signInAsTestUser } from "./helpers/auth";
import { COURSE_STAFF } from "./helpers/course-staff";
import {
  createTeam,
  addSprint,
  isoDate,
  joinAsInstructor,
  joinTeam,
  signedInPage,
  expectNoBlockingViolations,
} from "./helpers/teams";

async function settings(page: Page, login: string) {
  await signInAsTestUser(page, { login, name: login });
  return createTeam(page, login);
}

test("sprint selector preserves focus and follows Back and Forward", async ({
  page,
}) => {
  const teamId = await settings(page, "selector-focus");
  const older = await addSprint(page, {
    teamId,
    name: "Previous",
    startOffset: -14,
    endOffset: -8,
  });
  const current = await addSprint(page, {
    teamId,
    name: "Current",
    startOffset: -3,
    endOffset: 3,
  });
  await page.goto(`/teams/${teamId}/dashboard`);
  const selector = page.getByLabel("Sprint", { exact: true });
  await selector.focus();
  await selector.selectOption(older);
  await expect(
    page.getByRole("heading", { name: "Previous", exact: true })
  ).toBeVisible();
  await expect(selector).toBeFocused();
  await page.goBack();
  await expect(selector).toHaveValue(current);
  await page.goForward();
  await expect(selector).toHaveValue(older);
  await expectNoBlockingViolations(page);
});
test("sprint add, save, edit and cancel keep focus on the next control", async ({
  page,
}) => {
  await settings(page, "sprint-focus");
  const add = page.getByRole("button", { name: "Add sprint", exact: true });
  await add.click();
  await expect(page.getByLabel("Sprint name")).toBeFocused();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(add).toBeFocused();
  await add.click();
  await page.getByLabel("Sprint name").fill("Focus sprint");
  await page.getByLabel("Start date", { exact: true }).fill(isoDate(-3));
  await page.getByLabel("End date", { exact: true }).fill(isoDate(3));
  await page.getByRole("button", { name: "Save sprint", exact: true }).click();
  await expect(add).toBeFocused();
  const edit = page.getByRole("button", {
    name: "Edit Focus sprint",
    exact: true,
  });
  await edit.click();
  await expect(page.getByLabel("Sprint name")).toBeFocused();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(edit).toBeFocused();
  await edit.click();
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(edit).toBeFocused();
  await expectNoBlockingViolations(page);
});
test("invite mutations focus Copy or Create and token Done focuses its name", async ({
  page,
}) => {
  await settings(page, "invite-token-focus");
  const panel = page.getByRole("region", {
    name: "Member invite link",
    exact: true,
  });
  await panel.getByRole("button", { name: "Create link" }).click();
  await expect(panel.getByRole("button", { name: "Copy link" })).toBeFocused();
  await panel.getByRole("button", { name: "Revoke" }).click();
  await expect(
    panel.getByRole("button", { name: "Create link" })
  ).toBeFocused();
  await page.getByLabel("New token name").fill("Focus token");
  await page.getByRole("button", { name: "Create token" }).click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(page.getByLabel("New token name")).toBeFocused();
  await expectNoBlockingViolations(page);
});
for (const target of ["team", "sprint", "edit", "token"] as const) {
  test(`invalid ${target} submit focuses the first invalid field after its description exists`, async ({
    page,
  }) => {
    const teamId = await settings(page, `invalid-${target}-focus`);
    let label: string, button: string;
    if (target === "team") {
      await page.goto("/teams/new");
      label = "Team name";
      button = "Create team";
    } else if (target === "sprint") {
      await page.getByRole("button", { name: "Add sprint" }).click();
      label = "Sprint name";
      button = "Save sprint";
    } else if (target === "edit") {
      await addSprint(page, {
        teamId,
        name: "Edit errors",
        startOffset: -3,
        endOffset: 3,
      });
      await page.reload();
      await page.getByRole("button", { name: "Edit Edit errors" }).click();
      await page.getByLabel("Sprint name").fill("");
      label = "Sprint name";
      button = "Save changes";
    } else {
      label = "New token name";
      button = "Create token";
    }
    const field = page.getByLabel(label, { exact: true });
    // Record the description at the focus event, not after React's next render.
    await field.evaluate((element) =>
      element.addEventListener("focus", () => {
        element.setAttribute(
          "data-focus-description",
          (element.getAttribute("aria-describedby") ?? "")
            .split(" ")
            .map((id) => document.getElementById(id)?.textContent ?? "")
            .join(" ")
        );
      })
    );
    await page.getByRole("button", { name: button, exact: true }).click();
    await expect(field).toBeFocused();
    await expect(field).toHaveAttribute("aria-invalid", "true");
    await expect(field).toHaveAttribute(
      "data-focus-description",
      /required|Add a team name|Name the token/
    );
    await expectNoBlockingViolations(page);
  });
}
for (const role of ["MEMBER", "INSTRUCTOR"] as const) {
  test(`announces a teammate's new standup to a ${role} without moving focus`, async ({
    page,
    browser,
  }) => {
    const teamId = await settings(page, `live-lead-${role.toLowerCase()}`);
    await addSprint(page, {
      teamId,
      name: "Current",
      startOffset: -3,
      endOffset: 3,
    });
    const viewer = await signedInPage(browser, {
      login: `live-viewer-${role.toLowerCase()}`,
      name: "Viewer",
    });
    // Instructor links come from course staff (decision 006, #116).
    const staff =
      role === "INSTRUCTOR"
        ? await signedInPage(browser, COURSE_STAFF.liveStandup)
        : null;
    try {
      if (staff === null) {
        await joinTeam({ lead: page, joiner: viewer, teamId, role: "MEMBER" });
      } else {
        await joinAsInstructor({ staff, joiner: viewer, teamId });
      }
      await viewer.goto(`/teams/${teamId}/standups`);
      await expect(viewer.getByText("Live", { exact: true })).toBeVisible();
      const nav = viewer.getByRole("link", { name: "Settings", exact: true });
      await nav.focus();
      const response = await page.request.post(
        `/api/v1/teams/${teamId}/standups`,
        { data: { yesterday: "Yesterday", today: "Today's work" } }
      );
      expect(response.status()).toBe(201);
      const live = viewer.locator('[aria-live="polite"]');
      await expect(live).toHaveCount(1);
      await expect(live).toContainText(
        `live-lead-${role.toLowerCase()} posted a standup`
      );
      await expect(nav).toBeFocused();
      await expectNoBlockingViolations(viewer);
    } finally {
      await viewer.context().close();
      await staff?.context().close();
    }
  });
}
test("form controls draw their edge with the form-control border token", async ({
  page,
}) => {
  const teamId = await settings(page, "form-control-border");
  await addSprint(page, {
    teamId,
    name: "Current",
    startOffset: -3,
    endOffset: 3,
  });
  const pages = [
    { path: "/teams/new", open: null },
    { path: `/teams/${teamId}/settings`, open: "Add sprint" },
    { path: `/teams/${teamId}/standups`, open: null },
  ] as const;
  for (const { path, open } of pages) {
    await page.goto(path);
    if (open !== null)
      await page.getByRole("button", { name: open, exact: true }).click();
    const mismatches = await page
      .locator("main input, main select, main textarea, header select")
      .evaluateAll((elements) => {
        const token = getComputedStyle(document.documentElement)
          .getPropertyValue("--form-control-border")
          .trim();
        const probe = document.createElement("div");
        probe.style.color = token;
        document.body.append(probe);
        const expected =
          token === "" ? "missing token" : getComputedStyle(probe).color;
        probe.remove();
        return elements
          .map((element) => ({
            name: element.getAttribute("name") ?? element.id,
            color: getComputedStyle(element).borderTopColor,
          }))
          .filter((control) => control.color !== expected)
          .map(
            (control) =>
              `${control.name}: ${control.color} (expected ${expected})`
          );
      });
    expect(mismatches, path).toEqual([]);
  }
});
