import type { TestUser } from "./auth";

// Course staff for the E2E suite. playwright.config.ts gives the web server
// these logins as COURSE_STAFF_GITHUB_LOGINS, so they can create instructor
// invite links on any team (decision 006, #116). One per test that needs one,
// so parallel sign-ins never create the same user at once.
export const COURSE_STAFF = {
  dashboard: { login: "staff-dashboard-e2e", name: "Course staff" },
  review: { login: "staff-review-e2e", name: "Course staff" },
  standup: { login: "staff-standup-e2e", name: "Course staff" },
  liveStandup: { login: "staff-live-standup-e2e", name: "Course staff" },
  onboarding: { login: "staff-onboarding-e2e", name: "Course staff" },
  retro: { login: "staff-retro-e2e", name: "Course staff" },
  webhookSecret: { login: "staff-webhook-secret-e2e", name: "Course staff" },
  peerFeedback: { login: "staff-peer-feedback-e2e", name: "Course staff" },
} as const satisfies Record<string, TestUser>;

export const COURSE_STAFF_GITHUB_LOGINS = Object.values(COURSE_STAFF)
  .map((user) => user.login)
  .join(",");
