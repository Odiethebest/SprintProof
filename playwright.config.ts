import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "list",
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
    command: "npm run dev",
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
    },
  },
});
