import fs from "node:fs";
import path from "node:path";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from "vitest";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { getSessionUserId } from "@/server/auth-session";
import { catchUnexpectedErrors } from "@/server/api-response";
import { GET as listTeams, POST as createTeam } from "@/app/api/v1/teams/route";
import { GET as getTeam } from "@/app/api/v1/teams/[teamId]/route";
import { POST as createInvite } from "@/app/api/v1/teams/[teamId]/invites/route";
import { DELETE as revokeInvite } from "@/app/api/v1/teams/[teamId]/invites/[inviteId]/route";
import { POST as joinTeam } from "@/app/api/v1/memberships/route";
import {
  GET as listSprints,
  POST as createSprint,
} from "@/app/api/v1/teams/[teamId]/sprints/route";
import { PATCH as editSprint } from "@/app/api/v1/teams/[teamId]/sprints/[sprintId]/route";
import { GET as getSummary } from "@/app/api/v1/teams/[teamId]/sprints/[sprintId]/summary/route";
import { GET as listSprintStandups } from "@/app/api/v1/teams/[teamId]/sprints/[sprintId]/standups/route";
import {
  GET as getRetro,
  PATCH as closeRetro,
  POST as openRetro,
} from "@/app/api/v1/teams/[teamId]/sprints/[sprintId]/retro/route";
import { POST as addRetroItem } from "@/app/api/v1/teams/[teamId]/sprints/[sprintId]/retro/items/route";
import {
  DELETE as unvoteRetroItem,
  PUT as voteRetroItem,
} from "@/app/api/v1/teams/[teamId]/sprints/[sprintId]/retro/items/[itemId]/vote/route";
import { PATCH as updateActionItem } from "@/app/api/v1/teams/[teamId]/sprints/[sprintId]/retro/action-items/[actionItemId]/route";
import { GET as listPeerFeedback } from "@/app/api/v1/teams/[teamId]/sprints/[sprintId]/peer-feedback/route";
import { PUT as savePeerFeedback } from "@/app/api/v1/teams/[teamId]/sprints/[sprintId]/peer-feedback/[recipientId]/route";
import { POST as postStandup } from "@/app/api/v1/teams/[teamId]/standups/route";
import { POST as createToken } from "@/app/api/v1/tokens/route";
import { DELETE as revokeToken } from "@/app/api/v1/tokens/[tokenId]/route";
import {
  insertApiToken,
  insertInvite,
  insertMembership,
  insertRetro,
  insertSprint,
  insertTeam,
  insertUser,
} from "../../factories/db";
import {
  createSprintInput,
  createStandupInput,
  createTeamInput,
} from "../../factories/validation-inputs";
import { apiGetRequest, apiRequest, routeContext } from "../helpers/requests";
import { clearDatabase } from "../setup/test-setup";

vi.mock("@/server/auth-session", () => ({ getSessionUserId: vi.fn() }));
vi.mock("@/server/realtime", () => ({ triggerTeamEvent: vi.fn() }));

const INTERNAL_ERROR = {
  error: {
    code: "INTERNAL_ERROR",
    message: "Something went wrong on our side. Try again in a moment.",
  },
};

// A real database failure in this suite's own test database: a table the
// route needs is renamed for one test, then renamed back (also before each
// test, in case an earlier run stopped halfway).
const TABLES = {
  memberships: {
    hide: () =>
      db.$executeRaw`ALTER TABLE memberships RENAME TO memberships_unavailable`,
    restore: () =>
      db.$executeRaw`ALTER TABLE IF EXISTS memberships_unavailable RENAME TO memberships`,
  },
  api_tokens: {
    hide: () =>
      db.$executeRaw`ALTER TABLE api_tokens RENAME TO api_tokens_unavailable`,
    restore: () =>
      db.$executeRaw`ALTER TABLE IF EXISTS api_tokens_unavailable RENAME TO api_tokens`,
  },
  standups: {
    hide: () =>
      db.$executeRaw`ALTER TABLE standups RENAME TO standups_unavailable`,
    restore: () =>
      db.$executeRaw`ALTER TABLE IF EXISTS standups_unavailable RENAME TO standups`,
  },
  peer_feedback: {
    hide: () =>
      db.$executeRaw`ALTER TABLE peer_feedback RENAME TO peer_feedback_unavailable`,
    restore: () =>
      db.$executeRaw`ALTER TABLE IF EXISTS peer_feedback_unavailable RENAME TO peer_feedback`,
  },
};

type Table = keyof typeof TABLES;

async function restoreAllTables() {
  for (const table of Object.values(TABLES)) {
    await table.restore();
  }
}

async function withTablesMissing<T>(
  tables: Table[],
  run: () => Promise<T>
): Promise<T> {
  try {
    for (const table of tables) {
      await TABLES[table].hide();
    }
    return await run();
  } finally {
    await restoreAllTables();
  }
}

let consoleError: MockInstance<typeof console.error>;

// Everything the error log printed, as one string.
function loggedText(): string {
  return consoleError.mock.calls.flat().map(String).join(" ");
}

beforeEach(async () => {
  await restoreAllTables();
  await clearDatabase();
  vi.mocked(getSessionUserId).mockReset();
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  consoleError.mockRestore();
  vi.useRealTimers();
});

describe("catchUnexpectedErrors", () => {
  const route = "GET /api/v1/teams/{teamId}/sprints";

  it("returns the handler's response when nothing throws", async () => {
    // Act
    const res = await catchUnexpectedErrors({
      route,
      handler: async () => Response.json({ ok: true }, { status: 201 }),
    });

    // Assert
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ ok: true });
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("answers a thrown error with 500 INTERNAL_ERROR, without its message or stack", async () => {
    // Act
    const res = await catchUnexpectedErrors({
      route,
      handler: async () => {
        throw new Error(
          'duplicate key value violates unique constraint "users_github_login_key"'
        );
      },
    });

    // Assert: exactly the shared error shape, nothing else
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual(INTERNAL_ERROR);
  });

  it("logs the route and the error's name, never its message", async () => {
    // Act
    await catchUnexpectedErrors({
      route,
      handler: async () => {
        throw new TypeError("Cannot read the standup text 'Met my advisor'");
      },
    });

    // Assert
    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(loggedText()).toContain(route);
    expect(loggedText()).toContain("TypeError");
    expect(loggedText()).not.toContain("advisor");
  });

  it("lets a Next.js redirect through for Next.js to handle", async () => {
    // Act
    const result = catchUnexpectedErrors({
      route,
      handler: async () => redirect("/signin"),
    });

    // Assert
    await expect(result).rejects.toMatchObject({
      digest: expect.stringMatching(/^NEXT_REDIRECT/),
    });
    expect(consoleError).not.toHaveBeenCalled();
  });
});

interface RouteIds {
  teamId: string;
  sprintId: string;
  inviteId: string;
  inviteToken: string;
  tokenId: string;
}

// Every /api/v1 route handler, called the way the app calls it: signed in as
// the team's lead, with a valid body.
const ROUTES: Array<{
  route: string;
  call: (ids: RouteIds) => Promise<Response>;
}> = [
  {
    route: "GET /api/v1/teams",
    call: () => listTeams(apiGetRequest("/teams")),
  },
  {
    route: "POST /api/v1/teams",
    call: () => createTeam(apiRequest("POST", "/teams", createTeamInput())),
  },
  {
    route: "GET /api/v1/teams/{teamId}",
    call: ({ teamId }) =>
      getTeam(apiGetRequest(`/teams/${teamId}`), routeContext({ teamId })),
  },
  {
    route: "POST /api/v1/teams/{teamId}/invites",
    call: ({ teamId }) =>
      createInvite(
        apiRequest("POST", `/teams/${teamId}/invites`, { role: "MEMBER" }),
        routeContext({ teamId })
      ),
  },
  {
    route: "DELETE /api/v1/teams/{teamId}/invites/{inviteId}",
    call: ({ teamId, inviteId }) =>
      revokeInvite(
        apiRequest("DELETE", `/teams/${teamId}/invites/${inviteId}`),
        routeContext({ teamId, inviteId })
      ),
  },
  {
    route: "POST /api/v1/memberships",
    call: ({ inviteToken }) =>
      joinTeam(apiRequest("POST", "/memberships", { inviteToken })),
  },
  {
    route: "GET /api/v1/teams/{teamId}/sprints",
    call: ({ teamId }) =>
      listSprints(
        apiGetRequest(`/teams/${teamId}/sprints`),
        routeContext({ teamId })
      ),
  },
  {
    route: "POST /api/v1/teams/{teamId}/sprints",
    call: ({ teamId }) =>
      createSprint(
        apiRequest(
          "POST",
          `/teams/${teamId}/sprints`,
          createSprintInput({ startDate: "2026-12-01", endDate: "2026-12-07" })
        ),
        routeContext({ teamId })
      ),
  },
  {
    route: "PATCH /api/v1/teams/{teamId}/sprints/{sprintId}",
    call: ({ teamId, sprintId }) =>
      editSprint(
        apiRequest("PATCH", `/teams/${teamId}/sprints/${sprintId}`, {
          name: "Sprint 1 (renamed)",
        }),
        routeContext({ teamId, sprintId })
      ),
  },
  {
    route: "GET /api/v1/teams/{teamId}/sprints/{sprintId}/summary",
    call: ({ teamId, sprintId }) =>
      getSummary(
        apiGetRequest(`/teams/${teamId}/sprints/${sprintId}/summary`),
        routeContext({ teamId, sprintId })
      ),
  },
  {
    route: "GET /api/v1/teams/{teamId}/sprints/{sprintId}/standups",
    call: ({ teamId, sprintId }) =>
      listSprintStandups(
        apiGetRequest(`/teams/${teamId}/sprints/${sprintId}/standups`),
        routeContext({ teamId, sprintId })
      ),
  },
  {
    route: "GET /api/v1/teams/{teamId}/sprints/{sprintId}/retro",
    call: ({ teamId, sprintId }) =>
      getRetro(
        apiGetRequest(`/teams/${teamId}/sprints/${sprintId}/retro`),
        routeContext({ teamId, sprintId })
      ),
  },
  {
    route: "POST /api/v1/teams/{teamId}/sprints/{sprintId}/retro",
    call: ({ teamId, sprintId }) =>
      openRetro(
        apiRequest("POST", `/teams/${teamId}/sprints/${sprintId}/retro`),
        routeContext({ teamId, sprintId })
      ),
  },
  {
    route: "PATCH /api/v1/teams/{teamId}/sprints/{sprintId}/retro",
    call: ({ teamId, sprintId }) =>
      closeRetro(
        apiRequest("PATCH", `/teams/${teamId}/sprints/${sprintId}/retro`, {
          status: "CLOSED",
        }),
        routeContext({ teamId, sprintId })
      ),
  },
  {
    route: "POST /api/v1/teams/{teamId}/sprints/{sprintId}/retro/items",
    call: ({ teamId, sprintId }) =>
      addRetroItem(
        apiRequest("POST", `/teams/${teamId}/sprints/${sprintId}/retro/items`, {
          column: "WENT_WELL",
          text: "CI catches broken builds before review",
        }),
        routeContext({ teamId, sprintId })
      ),
  },
  {
    route:
      "PUT /api/v1/teams/{teamId}/sprints/{sprintId}/retro/items/{itemId}/vote",
    call: ({ teamId, sprintId }) =>
      voteRetroItem(
        apiRequest(
          "PUT",
          `/teams/${teamId}/sprints/${sprintId}/retro/items/item-1/vote`
        ),
        routeContext({ teamId, sprintId, itemId: "item-1" })
      ),
  },
  {
    route:
      "DELETE /api/v1/teams/{teamId}/sprints/{sprintId}/retro/items/{itemId}/vote",
    call: ({ teamId, sprintId }) =>
      unvoteRetroItem(
        apiRequest(
          "DELETE",
          `/teams/${teamId}/sprints/${sprintId}/retro/items/item-1/vote`
        ),
        routeContext({ teamId, sprintId, itemId: "item-1" })
      ),
  },
  {
    route:
      "PATCH /api/v1/teams/{teamId}/sprints/{sprintId}/retro/action-items/{actionItemId}",
    call: ({ teamId, sprintId }) =>
      updateActionItem(
        apiRequest(
          "PATCH",
          `/teams/${teamId}/sprints/${sprintId}/retro/action-items/action-item-1`,
          { isDone: true }
        ),
        routeContext({ teamId, sprintId, actionItemId: "action-item-1" })
      ),
  },
  {
    route: "GET /api/v1/teams/{teamId}/sprints/{sprintId}/peer-feedback",
    call: ({ teamId, sprintId }) =>
      listPeerFeedback(
        apiGetRequest(`/teams/${teamId}/sprints/${sprintId}/peer-feedback`),
        routeContext({ teamId, sprintId })
      ),
  },
  {
    route:
      "PUT /api/v1/teams/{teamId}/sprints/{sprintId}/peer-feedback/{recipientId}",
    call: ({ teamId, sprintId }) =>
      savePeerFeedback(
        apiRequest(
          "PUT",
          `/teams/${teamId}/sprints/${sprintId}/peer-feedback/user-1`,
          { text: "Reviews were thorough." }
        ),
        routeContext({ teamId, sprintId, recipientId: "user-1" })
      ),
  },
  {
    route: "POST /api/v1/teams/{teamId}/standups",
    call: ({ teamId }) =>
      postStandup(
        apiRequest("POST", `/teams/${teamId}/standups`, createStandupInput()),
        routeContext({ teamId })
      ),
  },
  {
    route: "POST /api/v1/tokens",
    call: () => createToken(apiRequest("POST", "/tokens", { name: "CLI" })),
  },
  {
    route: "DELETE /api/v1/tokens/{tokenId}",
    call: ({ tokenId }) =>
      revokeToken(
        apiRequest("DELETE", `/tokens/${tokenId}`),
        routeContext({ tokenId })
      ),
  },
];

// A lead on a team with a sprint, an invite link and an API token.
async function setUpLead(): Promise<RouteIds> {
  const user = await insertUser();
  const team = await insertTeam({ timezone: "America/Los_Angeles" });
  await insertMembership({ userId: user.id, teamId: team.id, role: "LEAD" });
  const sprint = await insertSprint({
    teamId: team.id,
    startDate: "2026-10-29",
    endDate: "2026-11-04",
  });
  // The invite is for another team, so joining it would add a membership.
  const otherTeam = await insertTeam();
  const invite = await insertInvite({ teamId: otherTeam.id, role: "MEMBER" });
  const { record } = await insertApiToken({ userId: user.id });
  vi.mocked(getSessionUserId).mockResolvedValue(user.id);
  return {
    teamId: team.id,
    sprintId: sprint.id,
    inviteId: invite.id,
    inviteToken: invite.token,
    tokenId: record.id,
  };
}

const API_DIR = path.join(process.cwd(), "src/app/api/v1");
const HTTP_METHOD =
  /export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\b/g;

// Every exported handler under src/app/api/v1, as "GET /api/v1/teams/{teamId}".
function listRouteHandlers(): string[] {
  return fs
    .readdirSync(API_DIR, { recursive: true, encoding: "utf8" })
    .filter((file) => path.basename(file) === "route.ts")
    .flatMap((file) => {
      const dir = path.dirname(file).split(path.sep).join("/");
      const routePath = `/api/v1/${dir}`.replace(/\[(\w+)\]/g, "{$1}");
      const source = fs.readFileSync(path.join(API_DIR, file), "utf8");
      return [...source.matchAll(HTTP_METHOD)].map(
        ([, method]) => `${method} ${routePath}`
      );
    });
}

describe("an /api/v1 route when the database fails", () => {
  it("has a case below for every route handler, so a new route can't skip it", () => {
    // Act
    const handlers = listRouteHandlers();

    // Assert
    expect(handlers.length).toBeGreaterThan(0);
    expect(ROUTES.map(({ route }) => route).sort()).toEqual(handlers.sort());
  });

  it.each(ROUTES)(
    "$route returns 500 INTERNAL_ERROR and logs its route and the error code",
    async ({ route, call }) => {
      // Arrange: every route reads memberships or api_tokens first
      const ids = await setUpLead();

      // Act
      const res = await withTablesMissing(["memberships", "api_tokens"], () =>
        call(ids)
      );

      // Assert: no table name, Prisma code or message in the response
      expect(res.status).toBe(500);
      expect(await res.json()).toEqual(INTERNAL_ERROR);
      expect(consoleError).toHaveBeenCalledTimes(1);
      expect(loggedText()).toContain(route);
      expect(loggedText()).toContain("P2021");
      expect(loggedText()).not.toContain("does not exist");
    }
  );

  it("never logs the request body, even when the database fails after reading it", async () => {
    // Arrange: Nov 2 in Los Angeles, inside the sprint; standups is missing
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-02T18:00:00Z"));
    const { teamId } = await setUpLead();
    const body = createStandupInput({
      yesterday: "Talked to my advisor about the deadline.",
      today: "Pair on the flaky webhook test.",
      blockers: "Waiting on the TA's reply.",
    });

    // Act
    const res = await withTablesMissing(["standups"], () =>
      postStandup(
        apiRequest("POST", `/teams/${teamId}/standups`, body),
        routeContext({ teamId })
      )
    );

    // Assert
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual(INTERNAL_ERROR);
    expect(loggedText()).toContain("POST /api/v1/teams/{teamId}/standups");
    expect(loggedText()).toContain("P2021");
    for (const text of ["advisor", "flaky webhook", "TA's reply"]) {
      expect(loggedText()).not.toContain(text);
    }
  });

  it("never logs peer feedback, even when the database fails after reading it (#14)", async () => {
    // Arrange: an open retro and a teammate; peer_feedback is missing
    const { teamId, sprintId } = await setUpLead();
    await insertRetro({ sprintId });
    const teammate = await insertUser();
    await insertMembership({ userId: teammate.id, teamId, role: "MEMBER" });

    // Act
    const res = await withTablesMissing(["peer_feedback"], () =>
      savePeerFeedback(
        apiRequest(
          "PUT",
          `/teams/${teamId}/sprints/${sprintId}/peer-feedback/${teammate.id}`,
          { text: "Missed two standups after the family emergency." }
        ),
        routeContext({ teamId, sprintId, recipientId: teammate.id })
      )
    );

    // Assert
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual(INTERNAL_ERROR);
    expect(loggedText()).toContain(
      "PUT /api/v1/teams/{teamId}/sprints/{sprintId}/peer-feedback/{recipientId}"
    );
    expect(loggedText()).toContain("P2021");
    expect(loggedText()).not.toContain("family emergency");
  });
});
