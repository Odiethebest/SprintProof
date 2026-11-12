import { describe, expect, it } from "vitest";
import {
  isProtectedPath,
  toContinueMessage,
  toSafeCallbackPath,
  toSignInPath,
} from "@/lib/auth/sign-in-redirect";

describe("isProtectedPath", () => {
  it.each([
    "/teams",
    "/teams/team-1/dashboard",
    "/teams/team-1/sprints/s-1/retro",
    "/review/team-1",
    "/invite/abc123",
  ])("protects %s", (pathname) => {
    expect(isProtectedPath({ pathname })).toBe(true);
  });

  it.each([
    "/",
    "/signin",
    "/api/auth/session",
    "/teamsx",
    "/reviewer",
    "/invitex",
  ])(
    "leaves %s public",
    (pathname) => {
      expect(isProtectedPath({ pathname })).toBe(false);
    }
  );
});

describe("toSignInPath", () => {
  it("sends the visitor to sign-in with the page they asked for as the callback", () => {
    // Act
    const path = toSignInPath({
      callbackPath: "/teams/team-1/dashboard?sprint=s-2",
    });

    // Assert
    expect(path).toBe(
      "/signin?callbackUrl=%2Fteams%2Fteam-1%2Fdashboard%3Fsprint%3Ds-2"
    );
  });
});

describe("toSafeCallbackPath", () => {
  it("keeps a path on this site, including its query", () => {
    expect(
      toSafeCallbackPath({ callbackUrl: "/teams/team-1/dashboard?sprint=s-2" })
    ).toBe("/teams/team-1/dashboard?sprint=s-2");
  });

  it("falls back to the home page when there is no callback", () => {
    expect(toSafeCallbackPath({ callbackUrl: undefined })).toBe("/");
  });

  it.each([
    ["an absolute URL to another site", "https://evil.example/teams/team-1"],
    ["a protocol-relative URL", "//evil.example/teams/team-1"],
    ["a backslash URL that browsers read as another host", "/\\evil.example"],
    ["a javascript: URL", "javascript:alert(1)"],
    ["a path without a leading slash", "teams/team-1"],
    ["the sign-in page itself", "/signin?callbackUrl=%2Fteams"],
  ])("rejects %s", (_label, callbackUrl) => {
    expect(toSafeCallbackPath({ callbackUrl })).toBe("/");
  });

  it("rejects a callback given more than once", () => {
    expect(
      toSafeCallbackPath({
        callbackUrl: ["/teams/team-1", "https://evil.example"],
      })
    ).toBe("/");
  });
});

describe("toContinueMessage", () => {
  it.each([
    ["/teams/team-1/dashboard", "Sign in to continue to the dashboard."],
    [
      "/teams/team-1/dashboard/?sprint=s-2",
      "Sign in to continue to the dashboard.",
    ],
    ["/teams/team-1/standups", "Sign in to continue to standups."],
    ["/teams/team-1/retro", "Sign in to continue to the retro."],
    ["/teams/team-1/sprints/s-1/retro", "Sign in to continue to the retro."],
    ["/teams/team-1/settings", "Sign in to continue to settings."],
    ["/review/team-1", "Sign in to continue to the review page."],
    ["/invite/abc123", "Sign in to continue to your invite."],
  ])("names the page for %s", (callbackPath, message) => {
    expect(toContinueMessage({ callbackPath })).toBe(message);
  });

  it.each(["/", "/teams", "/teams/team-1/unknown"])(
    "shows no message for %s",
    (callbackPath) => {
      expect(toContinueMessage({ callbackPath })).toBeNull();
    }
  );
});
