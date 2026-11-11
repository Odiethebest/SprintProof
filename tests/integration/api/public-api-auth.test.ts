import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import { getSessionUserId } from "@/server/auth-session";
import type { TeamRole } from "@/lib/auth/team-access";
import { GET as listTeamsRoute } from "@/app/api/v1/teams/route";
import { GET as teamRoute } from "@/app/api/v1/teams/[teamId]/route";
import {
  GET as listSprintsRoute,
  POST as createSprintRoute,
} from "@/app/api/v1/teams/[teamId]/sprints/route";
import { GET as sprintSummaryRoute } from "@/app/api/v1/teams/[teamId]/sprints/[sprintId]/summary/route";
import { GET as sprintStandupsRoute } from "@/app/api/v1/teams/[teamId]/sprints/[sprintId]/standups/route";
import { POST as postStandupRoute } from "@/app/api/v1/teams/[teamId]/standups/route";
import { POST as createTokenRoute } from "@/app/api/v1/tokens/route";
import {
  insertApiToken,
  insertMembership,
  insertSprint,
  insertTeam,
  insertUser,
} from "../../factories/db";
import { apiGetRequest, bearer, routeContext } from "../helpers/requests";
import { clearDatabase } from "../setup/test-setup";

vi.mock("@/server/auth-session", () => ({ getSessionUserId: vi.fn() }));
vi.mock("@/server/realtime", () => ({ triggerTeamEvent: vi.fn() }));

const INVALID_TOKEN = {
  error: {
    code: "INVALID_TOKEN",
    message: "This API token isn't valid. Create a new one in Settings.",
  },
};

// A well-formed token that was never created.
const UNKNOWN_TOKEN = `spk_live_${"y".repeat(43)}`;

interface CallOptions {
  teamId: string;
  sprintId: string;
  authorization?: string;
}

interface Endpoint {
  name: string;
  call: (options: CallOptions) => Promise<Response>;
}

// The endpoints that read one team's data with an API token (#16, #97).
const TEAM_ENDPOINTS: Endpoint[] = [
  {
    name: "GET /teams/{teamId}",
    call: ({ teamId, authorization }) =>
      teamRoute(
        apiGetRequest(`/teams/${teamId}`, { authorization }),
        routeContext({ teamId })
      ),
  },
  {
    name: "GET /teams/{teamId}/sprints",
    call: ({ teamId, authorization }) =>
      listSprintsRoute(
        apiGetRequest(`/teams/${teamId}/sprints`, { authorization }),
        routeContext({ teamId })
      ),
  },
  {
    name: "GET /teams/{teamId}/sprints/{sprintId}/summary",
    call: ({ teamId, sprintId, authorization }) =>
      sprintSummaryRoute(
        apiGetRequest(`/teams/${teamId}/sprints/${sprintId}/summary`, {
          authorization,
        }),
        routeContext({ teamId, sprintId })
      ),
  },
  {
    name: "GET /teams/{teamId}/sprints/{sprintId}/standups",
    call: ({ teamId, sprintId, authorization }) =>
      sprintStandupsRoute(
        apiGetRequest(`/teams/${teamId}/sprints/${sprintId}/standups`, {
          authorization,
        }),
        routeContext({ teamId, sprintId })
      ),
  },
];

// Every endpoint that takes an API token: the caller's own team list (#97)
// and the reads of one team above.
const ENDPOINTS: Endpoint[] = [
  {
    name: "GET /teams",
    call: ({ authorization }) =>
      listTeamsRoute(apiGetRequest("/teams", { authorization })),
  },
  ...TEAM_ENDPOINTS,
];

async function setUpTeam(role: TeamRole = "MEMBER") {
  const team = await insertTeam();
  const sprint = await insertSprint({ teamId: team.id });
  const user = await insertUser();
  await insertMembership({ userId: user.id, teamId: team.id, role });
  const { token, record } = await insertApiToken({ userId: user.id });
  return {
    teamId: team.id,
    sprintId: sprint.id,
    user,
    token,
    tokenId: record.id,
  };
}

describe.each(ENDPOINTS)("$name with an API token", ({ call }) => {
  beforeEach(async () => {
    await clearDatabase();
    vi.mocked(getSessionUserId).mockReset();
    // No session: API clients send only the token.
    vi.mocked(getSessionUserId).mockResolvedValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each(["LEAD", "MEMBER", "INSTRUCTOR"] as const)(
    "answers a %s's token with 200",
    async (role) => {
      // Arrange
      const { teamId, sprintId, token } = await setUpTeam(role);

      // Act
      const res = await call({
        teamId,
        sprintId,
        authorization: bearer(token),
      });

      // Assert
      expect(res.status).toBe(200);
    }
  );

  it("records when the token was last used", async () => {
    // Arrange
    const { teamId, sprintId, token, tokenId } = await setUpTeam();
    // Only Date is faked, so the database driver's timers keep running.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-03T20:00:00Z"));

    // Act
    await call({ teamId, sprintId, authorization: bearer(token) });

    // Assert
    const row = await db.apiToken.findUniqueOrThrow({ where: { id: tokenId } });
    expect(row.lastUsedAt).toEqual(new Date("2026-11-03T20:00:00Z"));
  });

  it("returns 401 UNAUTHENTICATED with no token and no session", async () => {
    // Arrange
    const { teamId, sprintId } = await setUpTeam();

    // Act
    const res = await call({ teamId, sprintId });

    // Assert
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("UNAUTHENTICATED");
  });

  it.each([
    ["a token that was never created", () => bearer(UNKNOWN_TOKEN)],
    ["a Bearer header with no token", () => "Bearer"],
    ["another scheme", (token: string) => `Basic ${token}`],
    ["a value that isn't a SprintProof token", () => bearer("not-a-token")],
  ])("returns 401 INVALID_TOKEN for %s", async (_, header) => {
    // Arrange
    const { teamId, sprintId, token } = await setUpTeam();

    // Act
    const res = await call({ teamId, sprintId, authorization: header(token) });

    // Assert
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual(INVALID_TOKEN);
  });

  it("returns 401 INVALID_TOKEN for a revoked token", async () => {
    // Arrange
    const { teamId, sprintId, token, tokenId } = await setUpTeam();
    await db.apiToken.delete({ where: { id: tokenId } });

    // Act
    const res = await call({ teamId, sprintId, authorization: bearer(token) });

    // Assert
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual(INVALID_TOKEN);
  });

  it("checks the token, not the session, when a request sends both", async () => {
    // Arrange: signed in as a member, but the header carries a bad token
    const { teamId, sprintId, user } = await setUpTeam();
    vi.mocked(getSessionUserId).mockResolvedValue(user.id);

    // Act
    const res = await call({
      teamId,
      sprintId,
      authorization: bearer(UNKNOWN_TOKEN),
    });

    // Assert
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual(INVALID_TOKEN);
  });

  it("still works with a session and no token, as the app calls it", async () => {
    // Arrange
    const { teamId, sprintId, user } = await setUpTeam();
    vi.mocked(getSessionUserId).mockResolvedValue(user.id);

    // Act
    const res = await call({ teamId, sprintId });

    // Assert
    expect(res.status).toBe(200);
  });
});

// GET /teams has no team to be outside of: it lists the owner's own teams.
describe.each(TEAM_ENDPOINTS)(
  "$name with an outsider's API token",
  ({ call }) => {
    beforeEach(async () => {
      await clearDatabase();
      vi.mocked(getSessionUserId).mockReset();
      vi.mocked(getSessionUserId).mockResolvedValue(null);
    });

    it("returns 403 FORBIDDEN for a token whose owner isn't on the team", async () => {
      // Arrange
      const { teamId, sprintId } = await setUpTeam();
      const outsider = await insertUser();
      const { token } = await insertApiToken({ userId: outsider.id });

      // Act
      const res = await call({
        teamId,
        sprintId,
        authorization: bearer(token),
      });

      // Assert
      expect(res.status).toBe(403);
      expect((await res.json()).error.code).toBe("FORBIDDEN");
    });
  }
);

// Tokens only read. Every other endpoint stays session-only, so a leaked
// token can't change team data or mint more tokens.
describe("endpoints that don't take an API token", () => {
  beforeEach(async () => {
    await clearDatabase();
    vi.mocked(getSessionUserId).mockReset();
    vi.mocked(getSessionUserId).mockResolvedValue(null);
  });

  it("returns 401 for a lead's token on POST /teams/{teamId}/sprints", async () => {
    // Arrange
    const { teamId, token } = await setUpTeam("LEAD");
    const request = new Request(
      `http://localhost:3000/api/v1/teams/${teamId}/sprints`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: bearer(token),
        },
        body: JSON.stringify({
          name: "Sprint 2",
          startDate: "2026-11-05",
          endDate: "2026-11-11",
        }),
      }
    );

    // Act
    const res = await createSprintRoute(request, routeContext({ teamId }));

    // Assert
    expect(res.status).toBe(401);
    expect(await db.sprint.count({ where: { teamId } })).toBe(1);
  });

  it("returns 401 for a member's token on POST /teams/{teamId}/standups", async () => {
    // Arrange
    const { teamId, token } = await setUpTeam("MEMBER");
    const request = new Request(
      `http://localhost:3000/api/v1/teams/${teamId}/standups`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: bearer(token),
        },
        body: JSON.stringify({ yesterday: "Docs.", today: "Tests." }),
      }
    );

    // Act
    const res = await postStandupRoute(request, routeContext({ teamId }));

    // Assert
    expect(res.status).toBe(401);
    expect(await db.standup.count()).toBe(0);
  });

  it("returns 401 for a token on POST /tokens", async () => {
    // Arrange
    const { user, token } = await setUpTeam();
    const request = new Request("http://localhost:3000/api/v1/tokens", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: bearer(token),
      },
      body: JSON.stringify({ name: "Minted by a token" }),
    });

    // Act
    const res = await createTokenRoute(request);

    // Assert
    expect(res.status).toBe(401);
    expect(await db.apiToken.count({ where: { userId: user.id } })).toBe(1);
  });
});
