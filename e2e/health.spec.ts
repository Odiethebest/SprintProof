import { expect, test } from "@playwright/test";

// The Database workflow and the production guard poll this endpoint
// (.github/workflows/). It answers with JSON, not a page, so there's nothing
// for axe to check.
test.describe("Health check", () => {
  test("answers ok without sign-in", async ({ request }) => {
    // Act: no session cookie, and a redirect to /signin would show as a 3xx
    const response = await request.get("/api/health", { maxRedirects: 0 });

    // Assert
    expect(response.status()).toBe(200);
    expect(await response.json()).toStrictEqual({ status: "ok", commit: null });
  });
});
