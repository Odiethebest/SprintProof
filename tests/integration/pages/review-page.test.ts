import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "next-auth";
import ReviewPage from "@/app/review/[teamId]/page";
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

function signInAs(user: User | null) {
  vi.mocked(getSessionUserId).mockResolvedValue(user?.id ?? null);
  vi.mocked(getSession).mockResolvedValue(
    user === null
      ? null
      : ({
          user: { id: user.id, name: user.name, githubLogin: user.githubLogin },
          expires: "2099-01-01T00:00:00.000Z",
        } satisfies Session)
  );
}

async function openReviewPage(teamId: string) {
  return getRenderOutcome(
    renderSuspended(
      ReviewPage({
        params: Promise.resolve({ teamId }),
        searchParams: Promise.resolve({}),
      })
    )
  );
}

async function teamWithMember(role: TeamRole) {
  const team = await insertTeam();
  await insertSprint({ teamId: team.id });
  const user = await insertUser();
  await insertMembership({ userId: user.id, teamId: team.id, role });
  return { team, user };
}

describe("review page access", () => {
  beforeEach(async () => {
    await clearDatabase();
    vi.mocked(getSessionUserId).mockReset();
    vi.mocked(getSession).mockReset();
  });

  it.each(["INSTRUCTOR", "LEAD"] as const)("opens for a %s", async (role) => {
    // Arrange
    const { team, user } = await teamWithMember(role);
    signInAs(user);

    // Act
    const outcome = await openReviewPage(team.id);

    // Assert
    expect(outcome).toEqual({ kind: "RENDERED" });
  });

  it("is not found for a member, like a team that doesn't exist", async () => {
    // Arrange
    const { team, user } = await teamWithMember("MEMBER");
    signInAs(user);

    // Act
    const outcome = await openReviewPage(team.id);

    // Assert
    expect(outcome).toEqual({ kind: "NOT_FOUND" });
  });

  it("is not found for someone who isn't on the team", async () => {
    // Arrange
    const { team } = await teamWithMember("LEAD");
    const outsider = await insertUser();
    signInAs(outsider);

    // Act
    const outcome = await openReviewPage(team.id);

    // Assert
    expect(outcome).toEqual({ kind: "NOT_FOUND" });
  });

  it("sends a request whose session has no user to sign-in with the review page as the callback", async () => {
    // Arrange
    const { team } = await teamWithMember("LEAD");
    signInAs(null);

    // Act
    const outcome = await openReviewPage(team.id);

    // Assert
    expect(outcome).toEqual({
      kind: "REDIRECT",
      url: `/signin?callbackUrl=${encodeURIComponent(`/review/${team.id}`)}`,
    });
  });
});
