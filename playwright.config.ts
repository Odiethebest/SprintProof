import { defineConfig, devices } from "@playwright/test";
import { COURSE_STAFF_GITHUB_LOGINS } from "./e2e/helpers/course-staff";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  // CI also writes an HTML report, uploaded as an artifact when the job fails.
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    // CI tests the production build from the step before; locally, the dev server.
    command: process.env.CI ? "npm run start" : "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    // Live updates go through a local Soketi container (a Pusher-compatible
    // server) with its default app credentials, which aren't secrets. Values
    // set in the shell win, so a run can point at another server.
    env: {
      PUSHER_APP_ID: process.env.PUSHER_APP_ID ?? "app-id",
      PUSHER_SECRET: process.env.PUSHER_SECRET ?? "app-secret",
      NEXT_PUBLIC_PUSHER_KEY: process.env.NEXT_PUBLIC_PUSHER_KEY ?? "app-key",
      NEXT_PUBLIC_PUSHER_CLUSTER:
        process.env.NEXT_PUBLIC_PUSHER_CLUSTER ?? "mt1",
      NEXT_PUBLIC_PUSHER_HOST:
        process.env.NEXT_PUBLIC_PUSHER_HOST ?? "localhost",
      NEXT_PUBLIC_PUSHER_PORT: process.env.NEXT_PUBLIC_PUSHER_PORT ?? "6001",
      // A fixed test value, not a secret: the server-wide transition fallback
      // (decision 005). Deliveries are signed with each team's own secret;
      // e2e/webhook-secret.spec.ts checks that a new team rejects this one.
      GITHUB_WEBHOOK_SECRET:
        process.env.GITHUB_WEBHOOK_SECRET ??
        "e2e-webhook-secret-not-a-real-secret",
      // The test users from e2e/helpers/course-staff.ts, who may create
      // instructor invite links on any team (decision 006, #116). Not taken
      // from the shell: the specs sign in as exactly these logins.
      COURSE_STAFF_GITHUB_LOGINS,
    },
  },
});
