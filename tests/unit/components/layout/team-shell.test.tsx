import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { usePathname, useSearchParams } from "next/navigation";
import type { TeamRole } from "@/lib/auth/team-access";
import { TeamShell } from "@/components/layout/team-shell";

// TeamShell reads the URL through these hooks, and outside Next.js there's no
// router to provide them.
vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
  useSearchParams: vi.fn(),
  useRouter: vi.fn(() => ({ push: vi.fn(), refresh: vi.fn() })),
}));

const SPRINT_SELECTOR = {
  options: [
    { id: "sprint-1", label: "Sprint 1 · Oct 29 – Nov 4 · Current" },
    { id: "sprint-0", label: "Sprint 0 · Oct 22 – Oct 28 · Ended" },
  ],
  selectedId: "sprint-1",
};

function renderShellAt(
  pathname: string,
  role: TeamRole = "LEAD",
  query = ""
): string {
  vi.mocked(usePathname).mockReturnValue(pathname);
  vi.mocked(useSearchParams).mockReturnValue(
    new URLSearchParams(query) as unknown as ReturnType<typeof useSearchParams>
  );
  return renderToStaticMarkup(
    <TeamShell
      teamId="team-1"
      team={{ name: "SprintProof", repoFullName: "Odiethebest/SprintProof" }}
      user={{ displayName: "Ziqi (Odie) Yang", githubLogin: "Odiethebest" }}
      role={role}
      sprintSelector={SPRINT_SELECTOR}
    >
      <main>Page content</main>
    </TeamShell>
  );
}

// The labels of the team navigation links marked aria-current="page".
function currentNavLinks(html: string): string[] {
  return [...html.matchAll(/<a aria-current="page"[^>]*>([^<]*)<\/a>/g)].map(
    (match) => match[1]
  );
}

function hasSprintSelector(html: string): boolean {
  return html.includes("<select");
}

// The id of the option the sprint selector shows as chosen.
function selectedSprintId(html: string): string | null {
  return /<option value="([^"]*)" selected="">/.exec(html)?.[1] ?? null;
}

// A team path the navigation doesn't list.
const UNLISTED_PATH = "/teams/team-1/sprints/sprint-1/planning";

describe("TeamShell", () => {
  it("marks no navigation item as current on a team page the navigation doesn't list", () => {
    // Act
    const html = renderShellAt(UNLISTED_PATH);

    // Assert
    expect(currentNavLinks(html)).toEqual([]);
  });

  it("shows no sprint selector on a team page the navigation doesn't list", () => {
    // Act
    const html = renderShellAt(UNLISTED_PATH);

    // Assert
    expect(hasSprintSelector(html)).toBe(false);
  });

  it("marks only the Retro link as current on a sprint's retro (#13)", () => {
    // Act
    const html = renderShellAt("/teams/team-1/sprints/sprint-0/retro");

    // Assert
    expect(currentNavLinks(html)).toEqual(["Retro"]);
  });

  it("shows the retro's own sprint in the sprint selector", () => {
    // Act
    const html = renderShellAt("/teams/team-1/sprints/sprint-0/retro");

    // Assert
    expect(hasSprintSelector(html)).toBe(true);
    expect(selectedSprintId(html)).toBe("sprint-0");
  });

  it("shows no sprint selector on the retro of a sprint the selector doesn't list", () => {
    // Act: an upcoming sprint isn't in the selector (AGENTS.md §2 Screens)
    const html = renderShellAt("/teams/team-1/sprints/sprint-2/retro");

    // Assert
    expect(hasSprintSelector(html)).toBe(false);
  });

  it("links Retro to the selected sprint's retro", () => {
    // Act
    const html = renderShellAt(
      "/teams/team-1/dashboard",
      "MEMBER",
      "sprint=sprint-0"
    );

    // Assert
    expect(html).toContain('href="/teams/team-1/retro?sprint=sprint-0"');
  });

  it("links Retro on a sprint's retro to that sprint", () => {
    // Act
    const html = renderShellAt("/teams/team-1/sprints/sprint-0/retro");

    // Assert
    expect(html).toContain('href="/teams/team-1/retro?sprint=sprint-0"');
  });

  it.each(["LEAD", "MEMBER", "INSTRUCTOR"] as const)(
    "links a %s to the retro",
    (role) => {
      // Act
      const html = renderShellAt("/teams/team-1/dashboard", role);

      // Assert
      expect(html).toContain('href="/teams/team-1/retro"');
    }
  );

  it.each([
    ["dashboard", "Dashboard"],
    ["standups", "Standups"],
    ["settings", "Settings"],
  ])("marks only the %s link as current on its page", (page, label) => {
    // Act
    const html = renderShellAt(`/teams/team-1/${page}`);

    // Assert
    expect(currentNavLinks(html)).toEqual([label]);
  });

  it.each(["dashboard", "standups"])(
    "shows the sprint selector on %s",
    (page) => {
      // Act
      const html = renderShellAt(`/teams/team-1/${page}`);

      // Assert
      expect(hasSprintSelector(html)).toBe(true);
    }
  );

  it("shows no sprint selector on settings", () => {
    // Act
    const html = renderShellAt("/teams/team-1/settings");

    // Assert
    expect(hasSprintSelector(html)).toBe(false);
  });

  it("marks only the Review link as current on the review page", () => {
    // Act
    const html = renderShellAt("/review/team-1");

    // Assert
    expect(currentNavLinks(html)).toEqual(["Review"]);
  });

  it("shows the sprint selector on the review page", () => {
    // Act
    const html = renderShellAt("/review/team-1");

    // Assert
    expect(hasSprintSelector(html)).toBe(true);
  });

  it.each(["LEAD", "INSTRUCTOR"] as const)(
    "links a %s to the review page",
    (role) => {
      // Act
      const html = renderShellAt("/teams/team-1/dashboard", role);

      // Assert
      expect(html).toContain('href="/review/team-1"');
    }
  );

  it("doesn't link a member to the review page", () => {
    // Act
    const html = renderShellAt("/teams/team-1/dashboard", "MEMBER");

    // Assert
    expect(html).not.toContain('href="/review/team-1"');
  });
});
