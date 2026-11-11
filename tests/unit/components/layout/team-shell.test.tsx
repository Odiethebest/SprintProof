import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { usePathname, useSearchParams } from "next/navigation";
import { TeamShell } from "@/components/layout/team-shell";

// TeamShell reads the URL through these hooks, and outside Next.js there's no
// router to provide them.
vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
  useSearchParams: vi.fn(),
  useRouter: vi.fn(() => ({ push: vi.fn(), refresh: vi.fn() })),
}));

const SPRINT_SELECTOR = {
  options: [{ id: "sprint-1", label: "Sprint 1 · Oct 29 – Nov 4 · Current" }],
  selectedId: "sprint-1",
};

function renderShellAt(pathname: string): string {
  vi.mocked(usePathname).mockReturnValue(pathname);
  vi.mocked(useSearchParams).mockReturnValue(
    new URLSearchParams() as unknown as ReturnType<typeof useSearchParams>
  );
  return renderToStaticMarkup(
    <TeamShell
      teamId="team-1"
      team={{ name: "SprintProof", repoFullName: "Odiethebest/SprintProof" }}
      user={{ displayName: "Ziqi (Odie) Yang", githubLogin: "Odiethebest" }}
      role="LEAD"
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

const RETRO_PATH = "/teams/team-1/sprints/sprint-1/retro";

describe("TeamShell", () => {
  it("marks no navigation item as current on a team page the navigation doesn't list", () => {
    // Act
    const html = renderShellAt(RETRO_PATH);

    // Assert
    expect(currentNavLinks(html)).toEqual([]);
  });

  it("shows no sprint selector on a team page the navigation doesn't list", () => {
    // Act
    const html = renderShellAt(RETRO_PATH);

    // Assert
    expect(hasSprintSelector(html)).toBe(false);
  });

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
});
