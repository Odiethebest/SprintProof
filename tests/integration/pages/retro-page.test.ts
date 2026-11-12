import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "next-auth";
import RetroIndexPage from "@/app/(app)/teams/[teamId]/retro/page";
import RetroPage from "@/app/(app)/teams/[teamId]/sprints/[sprintId]/retro/page";
import type { TeamRole } from "@/lib/auth/team-access";
import { getSession, getSessionUserId } from "@/server/auth-session";
import {
  insertMembership,
  insertSprint,
  insertTeam,
  insertUser,
} from "../../factories/db";
import {
  getRenderOutcome,
  renderSuspended,
} from "../helpers/server-components";
import { clearDatabase } from "../setup/test-setup";

// Auth.js reads the session from the request cookies, which only exist inside
// a Next.js request. Mock the session wrapper; everything else hits the database.
vi.mock("@/server/auth-session", () => ({
  getSession: vi.fn(),
  getSessionUserId: vi.fn(),
}));

type User = Awaited<ReturnType<typeof insertUser>>;

const DAY_MS = 24 * 60 * 60 * 1000;

// A YYYY-MM-DD date the given number of days from today. Sprints at least 3
// days wide on each side of today hold today in any timezone.
function isoDate(offsetDays: number): string {
  return new Date(Date.now() + offsetDays * DAY_MS).toISOString().slice(0, 10);
}

function signInAs(user: User) {
  vi.mocked(getSessionUserId).mockResolvedValue(user.id);
  vi.mocked(getSession).mockResolvedValue({
    user: { id: user.id, name: user.name, githubLogin: user.githubLogin },
    expires: "2099-01-01T00:00:00.000Z",
  } satisfies Session);
}

function openRetroIndex(teamId: string, sprint?: string) {
  return getRenderOutcome(
    renderSuspended(
      RetroIndexPage({
        params: Promise.resolve({ teamId }),
        searchParams: Promise.resolve(sprint === undefined ? {} : { sprint }),
      })
    )
  );
}

function openRetroPage(teamId: string, sprintId: string) {
  return getRenderOutcome(
    renderSuspended(
      RetroPage({ params: Promise.resolve({ teamId, sprintId }) })
    )
  );
}

// A team with an ended Sprint 1 and a running Sprint 2.
async function teamWithMember(role: TeamRole) {
  const team = await insertTeam();
  const ended = await insertSprint({
    teamId: team.id,
    name: "Sprint 1",
    startDate: isoDate(-14),
    endDate: isoDate(-8),
  });
  const current = await insertSprint({
    teamId: team.id,
    name: "Sprint 2",
    startDate: isoDate(-3),
    endDate: isoDate(3),
  });
  const user = await insertUser();
  await insertMembership({ userId: user.id, teamId: team.id, role });
  return { team, user, ended, current };
}

beforeEach(async () => {
  await clearDatabase();
  vi.mocked(getSessionUserId).mockReset();
  vi.mocked(getSession).mockReset();
});

describe("the team's Retro link (/teams/{teamId}/retro)", () => {
  it("opens the current sprint's retro", async () => {
    // Arrange
    const { team, user, current } = await teamWithMember("MEMBER");
    signInAs(user);

    // Act
    const outcome = await openRetroIndex(team.id);

    // Assert
    expect(outcome).toEqual({
      kind: "REDIRECT",
      url: `/teams/${team.id}/sprints/${current.id}/retro`,
    });
  });

  it("opens the retro of the sprint picked in the selector", async () => {
    // Arrange
    const { team, user, ended } = await teamWithMember("MEMBER");
    signInAs(user);

    // Act
    const outcome = await openRetroIndex(team.id, ended.id);

    // Assert
    expect(outcome).toEqual({
      kind: "REDIRECT",
      url: `/teams/${team.id}/sprints/${ended.id}/retro`,
    });
  });

  it("explains in place when no sprint has started yet", async () => {
    // Arrange
    const team = await insertTeam();
    await insertSprint({
      teamId: team.id,
      startDate: isoDate(10),
      endDate: isoDate(16),
    });
    const user = await insertUser();
    await insertMembership({ userId: user.id, teamId: team.id, role: "LEAD" });
    signInAs(user);

    // Act
    const outcome = await openRetroIndex(team.id);

    // Assert
    expect(outcome).toEqual({ kind: "RENDERED" });
  });

  it("is not found for someone who isn't on the team", async () => {
    // Arrange
    const { team } = await teamWithMember("LEAD");
    signInAs(await insertUser());

    // Act
    const outcome = await openRetroIndex(team.id);

    // Assert
    expect(outcome).toEqual({ kind: "NOT_FOUND" });
  });
});

describe("a sprint's retro page", () => {
  it.each(["LEAD", "MEMBER", "INSTRUCTOR"] as const)(
    "opens for a %s",
    async (role) => {
      // Arrange
      const { team, user, current } = await teamWithMember(role);
      signInAs(user);

      // Act
      const outcome = await openRetroPage(team.id, current.id);

      // Assert
      expect(outcome).toEqual({ kind: "RENDERED" });
    }
  );

  it("is not found for someone who isn't on the team", async () => {
    // Arrange
    const { team, current } = await teamWithMember("LEAD");
    signInAs(await insertUser());

    // Act
    const outcome = await openRetroPage(team.id, current.id);

    // Assert
    expect(outcome).toEqual({ kind: "NOT_FOUND" });
  });

  it("is not found for another team's sprint", async () => {
    // Arrange
    const { team, user } = await teamWithMember("LEAD");
    const other = await teamWithMember("LEAD");
    signInAs(user);

    // Act
    const outcome = await openRetroPage(team.id, other.current.id);

    // Assert
    expect(outcome).toEqual({ kind: "NOT_FOUND" });
  });

  it.each(["missing", "bad\u0000id"])(
    "is not found for the sprint id %j",
    async (sprintId) => {
      // Arrange
      const { team, user } = await teamWithMember("LEAD");
      signInAs(user);

      // Act
      const outcome = await openRetroPage(team.id, sprintId);

      // Assert
      expect(outcome).toEqual({ kind: "NOT_FOUND" });
    }
  );
});
