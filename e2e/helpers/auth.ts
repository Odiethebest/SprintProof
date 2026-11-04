import { expect, type Page } from "@playwright/test";

export interface TestUser {
  login: string;
  name: string;
}

// Signs in through the test-only credentials provider (E2E_TEST_AUTH=true).
// page.request shares cookies with the page, so later navigation is signed in.
export async function signInAsTestUser(
  page: Page,
  user: TestUser
): Promise<void> {
  const csrfRes = await page.request.get("/api/auth/csrf");
  expect(csrfRes.ok()).toBe(true);
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };

  const signInRes = await page.request.post(
    "/api/auth/callback/e2e-credentials",
    {
      form: { csrfToken, login: user.login, name: user.name, callbackUrl: "/" },
    }
  );
  expect(signInRes.ok()).toBe(true);

  const cookies = await page.context().cookies();
  expect(cookies.some((cookie) => cookie.name === "authjs.session-token")).toBe(
    true
  );
}
