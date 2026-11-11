import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSessionUserId } from "@/server/auth-session";
import { GET } from "@/app/api/v1/teams/[teamId]/route";
import { insertMembership, insertTeam, insertUser } from "../../factories/db";
import { apiGetRequest, routeContext } from "../helpers/requests";
import { clearDatabase } from "../setup/test-setup";

vi.mock("@/server/auth-session", () => ({ getSessionUserId: vi.fn() }));

const FORBIDDEN = {
  error: {
    code: "FORBIDDEN",
    message: "You don't have permission to do this on this team.",
  },
};

function getTeam(teamId: string) {
  return GET(apiGetRequest(`/teams/${teamId}`), routeContext({ teamId }));
}

// A lead, a member and an instructor, who joined in the reverse of role order.
async function setUpTeam() {
  const team = await insertTeam({
    name: "SprintProof",
    repoFullName: "Odiethebest/SprintProof",
    timezone: "America/Los_Angeles",
  });
  const alice = await insertUser({ name: "Alice Chen", githubLogin: "alice" });
  const bob = await insertUser({ name: "Bob Diaz", githubLogin: "bob" });
  const carol = await insertUser({ name: "Carol TA", githubLogin: "carol" });
  await insertMembership({
    userId: carol.id,
    teamId: team.id,
    role: "INSTRUCTOR",
  });
  await insertMembership({ userId: bob.id, teamId: team.id, role: "MEMBER" });
  await insertMembership({ userId: alice.id, teamId: team.id, role: "LEAD" });
  return { team, alice, bob, carol };
}

describe("GET /api/v1/teams/{teamId}", () => {
  beforeEach(async () => {
    await clearDatabase();
    vi.mocked(getSessionUserId).mockReset();
  });

  it("returns the team and its members, leads first, to a member of the team", async () => {
    // Arrange
    const { team, alice, bob, carol } = await setUpTeam();
    vi.mocked(getSessionUserId).mockResolvedValue(bob.id);

    // Act
    const res = await getTeam(team.id);

    // Assert
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      id: team.id,
      name: "SprintProof",
      repoFullName: "Odiethebest/SprintProof",
      timezone: "America/Los_Angeles",
      members: [
        {
          userId: alice.id,
          name: "Alice Chen",
          githubLogin: "alice",
          role: "LEAD",
        },
        {
          userId: bob.id,
          name: "Bob Diaz",
          githubLogin: "bob",
          role: "MEMBER",
        },
        {
          userId: carol.id,
          name: "Carol TA",
          githubLogin: "carol",
          role: "INSTRUCTOR",
        },
      ],
    });
  });

  it("lists a member who has no GitHub login with a null login", async () => {
    // Arrange
    const { team, alice } = await setUpTeam();
    const dana = await insertUser({ name: "Dana Lee", githubLogin: null });
    await insertMembership({
      userId: dana.id,
      teamId: team.id,
      role: "MEMBER",
    });
    vi.mocked(getSessionUserId).mockResolvedValue(alice.id);

    // Act
    const res = await getTeam(team.id);

    // Assert
    const { members } = await res.json();
    expect(members).toContainEqual({
      userId: dana.id,
      name: "Dana Lee",
      githubLogin: null,
      role: "MEMBER",
    });
  });

  it("returns 403 FORBIDDEN to a signed-in user who isn't on the team", async () => {
    // Arrange: the outsider leads another team
    const { team } = await setUpTeam();
    const outsider = await insertUser();
    const otherTeam = await insertTeam();
    await insertMembership({
      userId: outsider.id,
      teamId: otherTeam.id,
      role: "LEAD",
    });
    vi.mocked(getSessionUserId).mockResolvedValue(outsider.id);

    // Act
    const res = await getTeam(team.id);

    // Assert
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual(FORBIDDEN);
  });

  it.each([
    ["an unknown", "no-such-team"],
    ["an invalid", "bad\u0000id"],
  ])("returns the same 403 for %s team id", async (_label, teamId) => {
    // Arrange
    const { alice } = await setUpTeam();
    vi.mocked(getSessionUserId).mockResolvedValue(alice.id);

    // Act
    const res = await getTeam(teamId);

    // Assert
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual(FORBIDDEN);
  });
});
