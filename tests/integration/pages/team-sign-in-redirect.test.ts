import { beforeEach, describe, expect, it, vi } from "vitest";
import TeamLayout from "@/app/(app)/teams/[teamId]/layout";
import DashboardPage from "@/app/(app)/teams/[teamId]/dashboard/page";
import SettingsPage from "@/app/(app)/teams/[teamId]/settings/page";
import StandupsPage from "@/app/(app)/teams/[teamId]/standups/page";
import { getSession, getSessionUserId } from "@/server/auth-session";
import { insertTeam } from "../../factories/db";
import {
  collectRedirects,
  renderSuspended,
} from "../helpers/server-components";
import { clearDatabase } from "../setup/test-setup";

// The proxy lets a request with a session cookie through, but the session has
// no user, so requireTeamRole() returns 401 (#93).
vi.mock("@/server/auth-session", () => ({
  getSession: vi.fn(),
  getSessionUserId: vi.fn(),
}));

type Params = Promise<{ teamId: string }>;

const NO_SEARCH_PARAMS = Promise.resolve({});

const TEAM_PAGES = [
  {
    page: "dashboard",
    render: (params: Params) =>
      DashboardPage({ params, searchParams: NO_SEARCH_PARAMS }),
  },
  {
    page: "standups",
    render: (params: Params) =>
      StandupsPage({ params, searchParams: NO_SEARCH_PARAMS }),
  },
  {
    page: "settings",
    render: (params: Params) => SettingsPage({ params }),
  },
];

describe("team pages for a request whose session has no user", () => {
  beforeEach(async () => {
    await clearDatabase();
    vi.mocked(getSessionUserId).mockResolvedValue(null);
    vi.mocked(getSession).mockResolvedValue(null);
  });

  it.each(TEAM_PAGES)(
    "sends the visitor from $page to sign-in with $page as the callback",
    async ({ page, render }) => {
      // Arrange
      const team = await insertTeam();
      const params = Promise.resolve({ teamId: team.id });

      // Act: Next.js renders the layout and the page in parallel, so a
      // redirect from either one can reach the browser.
      const redirects = await collectRedirects([
        renderSuspended(TeamLayout({ params, children: null })),
        renderSuspended(render(params)),
      ]);

      // Assert
      const callbackPath = `/teams/${team.id}/${page}`;
      expect(new Set(redirects)).toEqual(
        new Set([`/signin?callbackUrl=${encodeURIComponent(callbackPath)}`])
      );
    }
  );
});
