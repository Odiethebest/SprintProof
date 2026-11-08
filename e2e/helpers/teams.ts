import { expect, type Browser, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { signInAsTestUser, type TestUser } from "./auth";

const DAY_MS = 24 * 60 * 60 * 1000;

// A YYYY-MM-DD date the given number of days from today (UTC).
export function isoDate(offsetDays: number): string {
  return new Date(Date.now() + offsetDays * DAY_MS).toISOString().slice(0, 10);
}

function uniqueRepo(): string {
  return `e2e-${Date.now()}-${Math.floor(Math.random() * 1000)}/sprintproof`;
}

export async function signedInPage(
  browser: Browser,
  user: TestUser
): Promise<Page> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signInAsTestUser(page, user);
  return page;
}

// Creates a team through the form; the signed-in user becomes its lead.
export async function createTeam(page: Page, name: string): Promise<string> {
  await page.goto("/teams/new");
  await page.getByLabel("Team name").fill(name);
  await page.getByLabel("GitHub repo").fill(uniqueRepo());
  await page.getByRole("button", { name: "Create team" }).click();
  await expect(page).toHaveURL(/\/teams\/[^/]+\/settings$/);
  return page.url().split("/").at(-2) ?? "";
}

// Offsets are days from today. Keep a current sprint at least 3 days wide on
// each side, so today is inside it in any timezone.
export async function addSprint(
  page: Page,
  input: {
    teamId: string;
    name: string;
    startOffset: number;
    endOffset: number;
  }
): Promise<string> {
  const response = await page.request.post(
    `/api/v1/teams/${input.teamId}/sprints`,
    {
      data: {
        name: input.name,
        startDate: isoDate(input.startOffset),
        endDate: isoDate(input.endOffset),
      },
    }
  );
  expect(response.status()).toBe(201);
  const sprint = (await response.json()) as { id: string };
  return sprint.id;
}

// The lead creates an invite link and the other user joins with its token.
export async function joinTeam(input: {
  lead: Page;
  joiner: Page;
  teamId: string;
  role: "MEMBER" | "INSTRUCTOR";
}): Promise<void> {
  const invite = await input.lead.request.post(
    `/api/v1/teams/${input.teamId}/invites`,
    { data: { role: input.role } }
  );
  expect(invite.status()).toBe(201);
  const { token } = (await invite.json()) as { token: string };
  const joined = await input.joiner.request.post("/api/v1/memberships", {
    data: { inviteToken: token },
  });
  expect(joined.status()).toBe(201);
}

export async function expectNoBlockingViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze();
  const blocking = results.violations.filter(
    (violation) =>
      violation.impact === "serious" || violation.impact === "critical"
  );
  expect(blocking).toEqual([]);
}
