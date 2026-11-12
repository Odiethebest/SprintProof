import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import { getSessionUserId } from "@/server/auth-session";
import { triggerTeamEvent } from "@/server/realtime";
import {
  GET as getRetroRoute,
  PATCH as closeRetroRoute,
  POST as openRetroRoute,
} from "@/app/api/v1/teams/[teamId]/sprints/[sprintId]/retro/route";
import { POST as addItemRoute } from "@/app/api/v1/teams/[teamId]/sprints/[sprintId]/retro/items/route";
import {
  DELETE as unvoteRoute,
  PUT as voteRoute,
} from "@/app/api/v1/teams/[teamId]/sprints/[sprintId]/retro/items/[itemId]/vote/route";
import { PATCH as updateActionItemRoute } from "@/app/api/v1/teams/[teamId]/sprints/[sprintId]/retro/action-items/[actionItemId]/route";
import {
  insertActionItem,
  insertMembership,
  insertRetro,
  insertRetroItem,
  insertRetroVote,
  insertSprint,
  insertTeam,
  insertUser,
} from "../../factories/db";
import { apiRequest, routeContext } from "../helpers/requests";
import { clearDatabase } from "../setup/test-setup";

// Integration tests mock external services at their wrappers (AGENTS.md §1 Testing).
vi.mock("@/server/auth-session", () => ({ getSessionUserId: vi.fn() }));
vi.mock("@/server/realtime", () => ({ triggerTeamEvent: vi.fn() }));

type User = Awaited<ReturnType<typeof insertUser>>;

function signInAs(user: User | null) {
  vi.mocked(getSessionUserId).mockResolvedValue(user?.id ?? null);
}

// A team with a lead, a member, an instructor and two sprints. Sprint 2 is
// inserted first, so "next sprint" has to go by start date, not insert order.
async function setUpTeam() {
  const team = await insertTeam();
  const lead = await insertUser({
    name: "Ziqi (Odie) Yang",
    githubLogin: "Odiethebest",
  });
  const member = await insertUser({
    name: "Yunhong Huang",
    githubLogin: "santiaojun",
  });
  const instructor = await insertUser({ name: "Course TA" });
  await insertMembership({ userId: lead.id, teamId: team.id, role: "LEAD" });
  await insertMembership({
    userId: member.id,
    teamId: team.id,
    role: "MEMBER",
  });
  await insertMembership({
    userId: instructor.id,
    teamId: team.id,
    role: "INSTRUCTOR",
  });
  const sprint3 = await insertSprint({
    teamId: team.id,
    name: "Sprint 3",
    startDate: "2026-11-12",
    endDate: "2026-11-18",
  });
  const sprint1 = await insertSprint({
    teamId: team.id,
    name: "Sprint 1",
    startDate: "2026-10-29",
    endDate: "2026-11-04",
  });
  const sprint2 = await insertSprint({
    teamId: team.id,
    name: "Sprint 2",
    startDate: "2026-11-05",
    endDate: "2026-11-11",
  });
  return { team, lead, member, instructor, sprint1, sprint2, sprint3 };
}

function retroPath(teamId: string, sprintId: string): string {
  return `/teams/${teamId}/sprints/${sprintId}/retro`;
}

function getRetro(teamId: string, sprintId: string) {
  return getRetroRoute(
    apiRequest("GET", retroPath(teamId, sprintId)),
    routeContext({ teamId, sprintId })
  );
}

function openRetro(teamId: string, sprintId: string) {
  return openRetroRoute(
    apiRequest("POST", retroPath(teamId, sprintId)),
    routeContext({ teamId, sprintId })
  );
}

function closeRetro(
  teamId: string,
  sprintId: string,
  body: unknown = { status: "CLOSED" }
) {
  return closeRetroRoute(
    apiRequest("PATCH", retroPath(teamId, sprintId), body),
    routeContext({ teamId, sprintId })
  );
}

function addItem(teamId: string, sprintId: string, body: unknown) {
  return addItemRoute(
    apiRequest("POST", `${retroPath(teamId, sprintId)}/items`, body),
    routeContext({ teamId, sprintId })
  );
}

function vote(teamId: string, sprintId: string, itemId: string) {
  return voteRoute(
    apiRequest("PUT", `${retroPath(teamId, sprintId)}/items/${itemId}/vote`),
    routeContext({ teamId, sprintId, itemId })
  );
}

function unvote(teamId: string, sprintId: string, itemId: string) {
  return unvoteRoute(
    apiRequest("DELETE", `${retroPath(teamId, sprintId)}/items/${itemId}/vote`),
    routeContext({ teamId, sprintId, itemId })
  );
}

function updateActionItem(
  teamId: string,
  sprintId: string,
  actionItemId: string,
  body: unknown
) {
  return updateActionItemRoute(
    apiRequest(
      "PATCH",
      `${retroPath(teamId, sprintId)}/action-items/${actionItemId}`,
      body
    ),
    routeContext({ teamId, sprintId, actionItemId })
  );
}

function storedVotes(userId: string) {
  return db.retroVote.count({ where: { userId } });
}

const RETRO_CLOSED = {
  error: {
    code: "RETRO_CLOSED",
    message: "This retro is closed, so its items and votes can't change.",
  },
};

const RETRO_NOT_FOUND = {
  error: {
    code: "RETRO_NOT_FOUND",
    message: "The lead hasn't opened this sprint's retro yet.",
  },
};

beforeEach(async () => {
  await clearDatabase();
  vi.mocked(getSessionUserId).mockReset();
  vi.mocked(triggerTeamEvent).mockReset();
});

describe("POST /api/v1/teams/{teamId}/sprints/{sprintId}/retro", () => {
  it("lets the lead open a sprint's retro", async () => {
    // Arrange
    const { team, lead, sprint1 } = await setUpTeam();
    signInAs(lead);

    // Act
    const res = await openRetro(team.id, sprint1.id);

    // Assert
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toEqual({
      id: expect.any(String),
      sprintId: sprint1.id,
      closedAt: null,
      createdAt: expect.any(String),
      votesLeft: 3,
      items: [],
      actionItems: [],
    });
    const stored = await db.retro.findUniqueOrThrow({
      where: { sprintId: sprint1.id },
    });
    expect(stored.closedAt).toBeNull();
  });

  it("tells teammates the retro changed", async () => {
    // Arrange
    const { team, lead, sprint1 } = await setUpTeam();
    signInAs(lead);

    // Act
    await openRetro(team.id, sprint1.id);

    // Assert
    expect(triggerTeamEvent).toHaveBeenCalledWith({
      teamId: team.id,
      event: "retro.updated",
    });
  });

  it.each(["member", "instructor"] as const)(
    "refuses a %s, since only the lead opens retros",
    async (who) => {
      // Arrange
      const setup = await setUpTeam();
      signInAs(setup[who]);

      // Act
      const res = await openRetro(setup.team.id, setup.sprint1.id);

      // Assert
      expect(res.status).toBe(403);
      expect(await db.retro.count()).toBe(0);
    }
  );

  it("refuses a second retro for the same sprint", async () => {
    // Arrange
    const { team, lead, sprint1 } = await setUpTeam();
    signInAs(lead);
    await openRetro(team.id, sprint1.id);

    // Act
    const res = await openRetro(team.id, sprint1.id);

    // Assert
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: {
        code: "RETRO_EXISTS",
        message: "This sprint already has a retro.",
      },
    });
    expect(await db.retro.count()).toBe(1);
  });

  it("opens one retro when the lead clicks twice at once", async () => {
    // Arrange
    const { team, lead, sprint1 } = await setUpTeam();
    signInAs(lead);

    // Act
    const responses = await Promise.all([
      openRetro(team.id, sprint1.id),
      openRetro(team.id, sprint1.id),
    ]);

    // Assert
    expect(responses.map((res) => res.status).sort()).toEqual([201, 409]);
    expect(await db.retro.count()).toBe(1);
  });

  it("returns 404 for another team's sprint", async () => {
    // Arrange
    const { team, lead } = await setUpTeam();
    const otherTeam = await insertTeam();
    const otherSprint = await insertSprint({ teamId: otherTeam.id });
    signInAs(lead);

    // Act
    const res = await openRetro(team.id, otherSprint.id);

    // Assert
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("SPRINT_NOT_FOUND");
  });

  it("returns 401 when signed out", async () => {
    // Arrange
    const { team, sprint1 } = await setUpTeam();
    signInAs(null);

    // Act
    const res = await openRetro(team.id, sprint1.id);

    // Assert
    expect(res.status).toBe(401);
  });
});

describe("GET /api/v1/teams/{teamId}/sprints/{sprintId}/retro", () => {
  it("returns 404 RETRO_NOT_FOUND before the lead opens it", async () => {
    // Arrange
    const { team, member, sprint1 } = await setUpTeam();
    signInAs(member);

    // Act
    const res = await getRetro(team.id, sprint1.id);

    // Assert
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual(RETRO_NOT_FOUND);
  });

  it("lists items by votes with their authors, the caller's votes and votes left", async () => {
    // Arrange
    const { team, lead, member, sprint1 } = await setUpTeam();
    const retro = await insertRetro({ sprintId: sprint1.id });
    const wentWell = await insertRetroItem({
      retroId: retro.id,
      authorId: member.id,
      column: "WENT_WELL",
      text: "CI catches broken builds before review",
      createdAt: new Date("2026-11-03T17:00:00Z"),
    });
    const toImprove = await insertRetroItem({
      retroId: retro.id,
      authorId: lead.id,
      column: "TO_IMPROVE",
      text: "Split the dashboard work into smaller PRs",
      createdAt: new Date("2026-11-03T18:00:00Z"),
    });
    await insertRetroVote({ itemId: toImprove.id, userId: member.id });
    await insertRetroVote({ itemId: toImprove.id, userId: lead.id });
    signInAs(member);

    // Act
    const res = await getRetro(team.id, sprint1.id);

    // Assert
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      id: retro.id,
      sprintId: sprint1.id,
      closedAt: null,
      createdAt: retro.createdAt.toISOString(),
      votesLeft: 2,
      items: [
        {
          id: toImprove.id,
          column: "TO_IMPROVE",
          text: "Split the dashboard work into smaller PRs",
          author: {
            userId: lead.id,
            name: "Ziqi (Odie) Yang",
            githubLogin: "Odiethebest",
          },
          voteCount: 2,
          hasVoted: true,
          createdAt: "2026-11-03T18:00:00.000Z",
        },
        {
          id: wentWell.id,
          column: "WENT_WELL",
          text: "CI catches broken builds before review",
          author: {
            userId: member.id,
            name: "Yunhong Huang",
            githubLogin: "santiaojun",
          },
          voteCount: 0,
          hasVoted: false,
          createdAt: "2026-11-03T17:00:00.000Z",
        },
      ],
      actionItems: [],
    });
  });

  it("lets an instructor read it, with no votes to spend", async () => {
    // Arrange
    const { team, instructor, sprint1 } = await setUpTeam();
    await insertRetro({ sprintId: sprint1.id });
    signInAs(instructor);

    // Act
    const res = await getRetro(team.id, sprint1.id);

    // Assert
    expect(res.status).toBe(200);
    expect((await res.json()).votesLeft).toBeNull();
  });

  it("refuses someone who isn't on the team", async () => {
    // Arrange
    const { team, sprint1 } = await setUpTeam();
    await insertRetro({ sprintId: sprint1.id });
    signInAs(await insertUser());

    // Act
    const res = await getRetro(team.id, sprint1.id);

    // Assert
    expect(res.status).toBe(403);
  });

  it("returns 404 SPRINT_NOT_FOUND for a sprint that doesn't exist", async () => {
    // Arrange
    const { team, member } = await setUpTeam();
    signInAs(member);

    // Act
    const res = await getRetro(team.id, "missing");

    // Assert
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("SPRINT_NOT_FOUND");
  });
});

describe("POST /api/v1/teams/{teamId}/sprints/{sprintId}/retro/items", () => {
  it("lets a member add an item to 'Went well'", async () => {
    // Arrange
    const { team, member, sprint1 } = await setUpTeam();
    await insertRetro({ sprintId: sprint1.id });
    signInAs(member);

    // Act
    const res = await addItem(team.id, sprint1.id, {
      column: "WENT_WELL",
      text: "  Pairing on the webhook design saved a day  ",
    });

    // Assert
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      id: expect.any(String),
      column: "WENT_WELL",
      text: "Pairing on the webhook design saved a day",
      author: {
        userId: member.id,
        name: "Yunhong Huang",
        githubLogin: "santiaojun",
      },
      voteCount: 0,
      hasVoted: false,
      createdAt: expect.any(String),
    });
    const stored = await db.retroItem.findFirstOrThrow();
    expect(stored).toMatchObject({
      authorId: member.id,
      column: "WENT_WELL",
      text: "Pairing on the webhook design saved a day",
    });
    expect(triggerTeamEvent).toHaveBeenCalledWith({
      teamId: team.id,
      event: "retro.updated",
    });
  });

  it("lets the lead add an item to 'To improve'", async () => {
    // Arrange
    const { team, lead, sprint1 } = await setUpTeam();
    await insertRetro({ sprintId: sprint1.id });
    signInAs(lead);

    // Act
    const res = await addItem(team.id, sprint1.id, {
      column: "TO_IMPROVE",
      text: "Agree on Prisma migration naming",
    });

    // Assert
    expect(res.status).toBe(201);
    expect((await res.json()).column).toBe("TO_IMPROVE");
  });

  it.each([
    [{ column: "WENT_WELL", text: "   " }, "Write the item first."],
    [
      { column: "ACTION_ITEMS", text: "Something" },
      "Pick Went well or To improve.",
    ],
    [
      { column: "WENT_WELL", text: "a".repeat(501) },
      "Use 500 characters or fewer.",
    ],
  ])("returns 400 for %j", async (body, message) => {
    // Arrange
    const { team, member, sprint1 } = await setUpTeam();
    await insertRetro({ sprintId: sprint1.id });
    signInAs(member);

    // Act
    const res = await addItem(team.id, sprint1.id, body);

    // Assert
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: { code: "VALIDATION_ERROR", message },
    });
    expect(await db.retroItem.count()).toBe(0);
  });

  it("returns 404 RETRO_NOT_FOUND before the lead opens the retro", async () => {
    // Arrange
    const { team, member, sprint1 } = await setUpTeam();
    signInAs(member);

    // Act
    const res = await addItem(team.id, sprint1.id, {
      column: "WENT_WELL",
      text: "Something",
    });

    // Assert
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual(RETRO_NOT_FOUND);
  });

  it("refuses new items once the retro is closed", async () => {
    // Arrange
    const { team, member, sprint1 } = await setUpTeam();
    await insertRetro({ sprintId: sprint1.id, closedAt: new Date() });
    signInAs(member);

    // Act
    const res = await addItem(team.id, sprint1.id, {
      column: "WENT_WELL",
      text: "Something",
    });

    // Assert
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual(RETRO_CLOSED);
    expect(await db.retroItem.count()).toBe(0);
  });

  it("refuses an instructor, who reads retros but doesn't add to them", async () => {
    // Arrange
    const { team, instructor, sprint1 } = await setUpTeam();
    await insertRetro({ sprintId: sprint1.id });
    signInAs(instructor);

    // Act
    const res = await addItem(team.id, sprint1.id, {
      column: "WENT_WELL",
      text: "Something",
    });

    // Assert
    expect(res.status).toBe(403);
  });

  it("refuses someone who isn't on the team", async () => {
    // Arrange
    const { team, sprint1 } = await setUpTeam();
    await insertRetro({ sprintId: sprint1.id });
    signInAs(await insertUser());

    // Act
    const res = await addItem(team.id, sprint1.id, {
      column: "WENT_WELL",
      text: "Something",
    });

    // Assert
    expect(res.status).toBe(403);
  });
});

describe("PUT /api/v1/teams/{teamId}/sprints/{sprintId}/retro/items/{itemId}/vote", () => {
  async function retroWithItems(count: number) {
    const setup = await setUpTeam();
    const retro = await insertRetro({ sprintId: setup.sprint1.id });
    const items = [];
    for (let n = 0; n < count; n++) {
      items.push(
        await insertRetroItem({ retroId: retro.id, authorId: setup.lead.id })
      );
    }
    return { ...setup, retro, items };
  }

  it("adds the member's vote and counts it", async () => {
    // Arrange
    const { team, member, sprint1, items } = await retroWithItems(1);
    signInAs(member);

    // Act
    const res = await vote(team.id, sprint1.id, items[0].id);

    // Assert
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      itemId: items[0].id,
      voteCount: 1,
      hasVoted: true,
      votesLeft: 2,
    });
    expect(await storedVotes(member.id)).toBe(1);
    expect(triggerTeamEvent).toHaveBeenCalledWith({
      teamId: team.id,
      event: "retro.updated",
    });
  });

  it("counts a teammate's vote on the same item too", async () => {
    // Arrange
    const { team, lead, member, sprint1, items } = await retroWithItems(1);
    await insertRetroVote({ itemId: items[0].id, userId: lead.id });
    signInAs(member);

    // Act
    const res = await vote(team.id, sprint1.id, items[0].id);

    // Assert
    expect((await res.json()).voteCount).toBe(2);
  });

  it("keeps one vote when the member votes for the same item twice (max 1 per item)", async () => {
    // Arrange
    const { team, member, sprint1, items } = await retroWithItems(1);
    signInAs(member);
    await vote(team.id, sprint1.id, items[0].id);

    // Act
    const res = await vote(team.id, sprint1.id, items[0].id);

    // Assert
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      itemId: items[0].id,
      voteCount: 1,
      hasVoted: true,
      votesLeft: 2,
    });
    expect(await storedVotes(member.id)).toBe(1);
  });

  it("refuses a 4th vote in the same retro and saves nothing", async () => {
    // Arrange
    const { team, member, sprint1, items } = await retroWithItems(4);
    for (const item of items.slice(0, 3)) {
      await insertRetroVote({ itemId: item.id, userId: member.id });
    }
    signInAs(member);

    // Act
    const res = await vote(team.id, sprint1.id, items[3].id);

    // Assert
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: {
        code: "NO_VOTES_LEFT",
        message:
          "You've used your 3 votes in this retro. Take one back to vote for this item.",
      },
    });
    expect(await storedVotes(member.id)).toBe(3);
  });

  it("gives each retro its own 3 votes", async () => {
    // Arrange: all 3 votes spent in Sprint 2's retro
    const { team, member, sprint1, sprint2, items } = await retroWithItems(1);
    const otherRetro = await insertRetro({ sprintId: sprint2.id });
    for (let n = 0; n < 3; n++) {
      const item = await insertRetroItem({
        retroId: otherRetro.id,
        authorId: member.id,
      });
      await insertRetroVote({ itemId: item.id, userId: member.id });
    }
    signInAs(member);

    // Act
    const res = await vote(team.id, sprint1.id, items[0].id);

    // Assert
    expect(res.status).toBe(200);
    expect((await res.json()).votesLeft).toBe(2);
  });

  it("saves only one of two votes sent at once with one vote left", async () => {
    // Arrange
    const { team, member, sprint1, items } = await retroWithItems(4);
    for (const item of items.slice(0, 2)) {
      await insertRetroVote({ itemId: item.id, userId: member.id });
    }
    signInAs(member);

    // Act
    const responses = await Promise.all([
      vote(team.id, sprint1.id, items[2].id),
      vote(team.id, sprint1.id, items[3].id),
    ]);

    // Assert
    expect(responses.map((res) => res.status).sort()).toEqual([200, 409]);
    expect(await storedVotes(member.id)).toBe(3);
  });

  it("returns 404 for an item in another sprint's retro", async () => {
    // Arrange
    const { team, member, sprint1, sprint2 } = await retroWithItems(0);
    const otherRetro = await insertRetro({ sprintId: sprint2.id });
    const otherItem = await insertRetroItem({
      retroId: otherRetro.id,
      authorId: member.id,
    });
    signInAs(member);

    // Act
    const res = await vote(team.id, sprint1.id, otherItem.id);

    // Assert
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      error: { code: "RETRO_ITEM_NOT_FOUND", message: "Retro item not found." },
    });
    expect(await storedVotes(member.id)).toBe(0);
  });

  it("refuses votes once the retro is closed", async () => {
    // Arrange
    const { team, member, sprint1, retro, items } = await retroWithItems(1);
    await db.retro.update({
      where: { id: retro.id },
      data: { closedAt: new Date() },
    });
    signInAs(member);

    // Act
    const res = await vote(team.id, sprint1.id, items[0].id);

    // Assert
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual(RETRO_CLOSED);
    expect(await storedVotes(member.id)).toBe(0);
  });

  it("refuses an instructor", async () => {
    // Arrange
    const { team, instructor, sprint1, items } = await retroWithItems(1);
    signInAs(instructor);

    // Act
    const res = await vote(team.id, sprint1.id, items[0].id);

    // Assert
    expect(res.status).toBe(403);
  });
});

describe("DELETE /api/v1/teams/{teamId}/sprints/{sprintId}/retro/items/{itemId}/vote", () => {
  it("takes the member's vote back and returns it to them", async () => {
    // Arrange
    const { team, lead, member, sprint1 } = await setUpTeam();
    const retro = await insertRetro({ sprintId: sprint1.id });
    const item = await insertRetroItem({
      retroId: retro.id,
      authorId: lead.id,
    });
    await insertRetroVote({ itemId: item.id, userId: member.id });
    await insertRetroVote({ itemId: item.id, userId: lead.id });
    signInAs(member);

    // Act
    const res = await unvote(team.id, sprint1.id, item.id);

    // Assert
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      itemId: item.id,
      voteCount: 1,
      hasVoted: false,
      votesLeft: 3,
    });
    expect(await storedVotes(member.id)).toBe(0);
    expect(await storedVotes(lead.id)).toBe(1);
    expect(triggerTeamEvent).toHaveBeenCalledWith({
      teamId: team.id,
      event: "retro.updated",
    });
  });

  it("changes nothing when the member hadn't voted for the item", async () => {
    // Arrange
    const { team, lead, member, sprint1 } = await setUpTeam();
    const retro = await insertRetro({ sprintId: sprint1.id });
    const item = await insertRetroItem({
      retroId: retro.id,
      authorId: lead.id,
    });
    await insertRetroVote({ itemId: item.id, userId: lead.id });
    signInAs(member);

    // Act
    const res = await unvote(team.id, sprint1.id, item.id);

    // Assert
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ voteCount: 1, hasVoted: false });
  });

  it("refuses to take a vote back once the retro is closed", async () => {
    // Arrange
    const { team, lead, member, sprint1 } = await setUpTeam();
    const retro = await insertRetro({
      sprintId: sprint1.id,
      closedAt: new Date(),
    });
    const item = await insertRetroItem({
      retroId: retro.id,
      authorId: lead.id,
    });
    await insertRetroVote({ itemId: item.id, userId: member.id });
    signInAs(member);

    // Act
    const res = await unvote(team.id, sprint1.id, item.id);

    // Assert
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual(RETRO_CLOSED);
    expect(await storedVotes(member.id)).toBe(1);
  });
});

describe("PATCH /api/v1/teams/{teamId}/sprints/{sprintId}/retro (close)", () => {
  // Sprint 1's retro: four "To improve" items with 2, 1, 1 and 0 votes, the
  // two 1-vote items created in reverse order, and a popular "Went well" item.
  async function retroReadyToClose() {
    const setup = await setUpTeam();
    const { lead, member, sprint1 } = setup;
    const retro = await insertRetro({ sprintId: sprint1.id });
    const item = (
      text: string,
      column: "WENT_WELL" | "TO_IMPROVE",
      at: string
    ) =>
      insertRetroItem({
        retroId: retro.id,
        authorId: member.id,
        column,
        text,
        createdAt: new Date(at),
      });
    const popularWentWell = await item(
      "CI catches broken builds before review",
      "WENT_WELL",
      "2026-11-03T16:00:00Z"
    );
    const twoVotes = await item(
      "Some PRs still wait more than a day for review",
      "TO_IMPROVE",
      "2026-11-03T19:00:00Z"
    );
    const laterOneVote = await item(
      "Write tomorrow's plan in the standup",
      "TO_IMPROVE",
      "2026-11-03T18:00:00Z"
    );
    const earlierOneVote = await item(
      "Split the dashboard work into smaller PRs",
      "TO_IMPROVE",
      "2026-11-03T17:00:00Z"
    );
    const noVotes = await item(
      "Agree on Prisma migration naming",
      "TO_IMPROVE",
      "2026-11-03T15:00:00Z"
    );
    for (const userId of [lead.id, member.id]) {
      await insertRetroVote({ itemId: popularWentWell.id, userId });
      await insertRetroVote({ itemId: twoVotes.id, userId });
    }
    await insertRetroVote({ itemId: laterOneVote.id, userId: lead.id });
    await insertRetroVote({ itemId: earlierOneVote.id, userId: member.id });
    return {
      ...setup,
      retro,
      items: {
        popularWentWell,
        twoVotes,
        laterOneVote,
        earlierOneVote,
        noVotes,
      },
    };
  }

  it("closes the retro and makes the top 3 'To improve' items the next sprint's action items (rule R6)", async () => {
    // Arrange
    const { team, lead, sprint1, sprint2, retro, items } =
      await retroReadyToClose();
    signInAs(lead);

    // Act
    const res = await closeRetro(team.id, sprint1.id);

    // Assert
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.closedAt).toEqual(expect.any(String));
    expect(body.actionItems).toEqual([
      {
        id: expect.any(String),
        sprintId: sprint2.id,
        retroItemId: items.twoVotes.id,
        text: "Some PRs still wait more than a day for review",
        voteCount: 2,
        isDone: false,
      },
      {
        id: expect.any(String),
        sprintId: sprint2.id,
        retroItemId: items.earlierOneVote.id,
        text: "Split the dashboard work into smaller PRs",
        voteCount: 1,
        isDone: false,
      },
      {
        id: expect.any(String),
        sprintId: sprint2.id,
        retroItemId: items.laterOneVote.id,
        text: "Write tomorrow's plan in the standup",
        voteCount: 1,
        isDone: false,
      },
    ]);
    const stored = await db.retro.findUniqueOrThrow({
      where: { id: retro.id },
    });
    expect(stored.closedAt).not.toBeNull();
    const actionItems = await db.actionItem.findMany({
      orderBy: { createdAt: "asc" },
    });
    expect(actionItems).toHaveLength(3);
    expect(
      new Set(actionItems.map((actionItem) => actionItem.sprintId))
    ).toEqual(new Set([sprint2.id]));
    expect(triggerTeamEvent).toHaveBeenCalledWith({
      teamId: team.id,
      event: "retro.updated",
    });
  });

  it("makes every 'To improve' item an action item when there are fewer than 3", async () => {
    // Arrange
    const { team, lead, member, sprint1 } = await setUpTeam();
    const retro = await insertRetro({ sprintId: sprint1.id });
    await insertRetroItem({
      retroId: retro.id,
      authorId: member.id,
      column: "TO_IMPROVE",
    });
    await insertRetroItem({
      retroId: retro.id,
      authorId: member.id,
      column: "WENT_WELL",
    });
    signInAs(lead);

    // Act
    const res = await closeRetro(team.id, sprint1.id);

    // Assert
    expect(res.status).toBe(200);
    expect((await res.json()).actionItems).toHaveLength(1);
  });

  it("refuses a member, since only the lead closes the retro", async () => {
    // Arrange
    const { team, member, sprint1, retro } = await retroReadyToClose();
    signInAs(member);

    // Act
    const res = await closeRetro(team.id, sprint1.id);

    // Assert
    expect(res.status).toBe(403);
    const stored = await db.retro.findUniqueOrThrow({
      where: { id: retro.id },
    });
    expect(stored.closedAt).toBeNull();
    expect(await db.actionItem.count()).toBe(0);
  });

  it("keeps the retro open when the team has no later sprint", async () => {
    // Arrange: Sprint 3 is the last sprint
    const { team, lead, member, sprint3 } = await setUpTeam();
    const retro = await insertRetro({ sprintId: sprint3.id });
    await insertRetroItem({ retroId: retro.id, authorId: member.id });
    signInAs(lead);

    // Act
    const res = await closeRetro(team.id, sprint3.id);

    // Assert
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: {
        code: "NO_NEXT_SPRINT",
        message:
          "Add the next sprint in Settings first. Its action items come from this retro.",
      },
    });
    const stored = await db.retro.findUniqueOrThrow({
      where: { id: retro.id },
    });
    expect(stored.closedAt).toBeNull();
    expect(await db.actionItem.count()).toBe(0);
  });

  it("refuses to close a retro twice, so no action item is made twice", async () => {
    // Arrange
    const { team, lead, sprint1 } = await retroReadyToClose();
    signInAs(lead);
    await closeRetro(team.id, sprint1.id);

    // Act
    const res = await closeRetro(team.id, sprint1.id);

    // Assert
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual(RETRO_CLOSED);
    expect(await db.actionItem.count()).toBe(3);
  });

  it("makes the action items once when the lead closes twice at once", async () => {
    // Arrange
    const { team, lead, sprint1 } = await retroReadyToClose();
    signInAs(lead);

    // Act
    const responses = await Promise.all([
      closeRetro(team.id, sprint1.id),
      closeRetro(team.id, sprint1.id),
    ]);

    // Assert
    expect(responses.map((res) => res.status).sort()).toEqual([200, 409]);
    expect(await db.actionItem.count()).toBe(3);
  });

  it("never saves a vote the closing retro didn't count", async () => {
    // Arrange: the lead takes back their vote on the later 1-vote item, so
    // it ties at 0 with the earlier "no votes" item and loses the tie
    const { team, lead, sprint1, items } = await retroReadyToClose();
    await db.retroVote.deleteMany({
      where: { itemId: items.laterOneVote.id, userId: lead.id },
    });
    signInAs(lead);

    // Act: the lead votes for it again while closing the retro
    const [closed, voted] = await Promise.all([
      closeRetro(team.id, sprint1.id),
      vote(team.id, sprint1.id, items.laterOneVote.id),
    ]);

    // Assert: a vote that was saved was counted (the item is an action
    // item), and a vote that came too late was refused and not saved
    expect(closed.status).toBe(200);
    const actionItemIds = (await closed.json()).actionItems.map(
      (actionItem: { retroItemId: string }) => actionItem.retroItemId
    );
    const savedVotes = await db.retroVote.count({
      where: { itemId: items.laterOneVote.id },
    });
    if (voted.status === 200) {
      expect(savedVotes).toBe(1);
      expect(actionItemIds).toContain(items.laterOneVote.id);
    } else {
      expect(await voted.json()).toEqual(RETRO_CLOSED);
      expect(savedVotes).toBe(0);
      expect(actionItemIds).toContain(items.noVotes.id);
    }
  });

  it("returns 404 RETRO_NOT_FOUND when the retro was never opened", async () => {
    // Arrange
    const { team, lead, sprint1 } = await setUpTeam();
    signInAs(lead);

    // Act
    const res = await closeRetro(team.id, sprint1.id);

    // Assert
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual(RETRO_NOT_FOUND);
  });

  it.each([{ status: "OPEN" }, {}])(
    "returns 400 for %j, since a retro can only be closed",
    async (body) => {
      // Arrange
      const { team, lead, sprint1, retro } = await retroReadyToClose();
      signInAs(lead);

      // Act
      const res = await closeRetro(team.id, sprint1.id, body);

      // Assert
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        error: {
          code: "VALIDATION_ERROR",
          message: 'Send { "status": "CLOSED" } to close the retro.',
        },
      });
      const stored = await db.retro.findUniqueOrThrow({
        where: { id: retro.id },
      });
      expect(stored.closedAt).toBeNull();
    }
  );

  it("lists the action items it made when the retro is read later", async () => {
    // Arrange
    const { team, lead, member, sprint1 } = await retroReadyToClose();
    signInAs(lead);
    await closeRetro(team.id, sprint1.id);
    signInAs(member);

    // Act
    const res = await getRetro(team.id, sprint1.id);

    // Assert
    const body = await res.json();
    expect(body.closedAt).toEqual(expect.any(String));
    expect(
      body.actionItems.map((actionItem: { text: string }) => actionItem.text)
    ).toEqual([
      "Some PRs still wait more than a day for review",
      "Split the dashboard work into smaller PRs",
      "Write tomorrow's plan in the standup",
    ]);
  });
});

describe("PATCH /api/v1/teams/{teamId}/sprints/{sprintId}/retro/action-items/{actionItemId}", () => {
  // Sprint 1's closed retro carried one action item into Sprint 2.
  async function carriedActionItem() {
    const setup = await setUpTeam();
    const retro = await insertRetro({
      sprintId: setup.sprint1.id,
      closedAt: new Date("2026-11-04T20:00:00Z"),
    });
    const item = await insertRetroItem({
      retroId: retro.id,
      authorId: setup.member.id,
      text: "Review each other's PRs within 24 hours",
    });
    await insertRetroVote({ itemId: item.id, userId: setup.lead.id });
    const actionItem = await insertActionItem({
      sprintId: setup.sprint2.id,
      retroItemId: item.id,
    });
    return { ...setup, item, actionItem };
  }

  it("lets a member check off an action item carried into the sprint", async () => {
    // Arrange
    const { team, member, sprint2, item, actionItem } =
      await carriedActionItem();
    signInAs(member);

    // Act
    const res = await updateActionItem(team.id, sprint2.id, actionItem.id, {
      isDone: true,
    });

    // Assert
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      id: actionItem.id,
      sprintId: sprint2.id,
      retroItemId: item.id,
      text: "Review each other's PRs within 24 hours",
      voteCount: 1,
      isDone: true,
    });
    const stored = await db.actionItem.findUniqueOrThrow({
      where: { id: actionItem.id },
    });
    expect(stored.isDone).toBe(true);
    expect(triggerTeamEvent).toHaveBeenCalledWith({
      teamId: team.id,
      event: "retro.updated",
    });
  });

  it("lets the lead uncheck it again", async () => {
    // Arrange
    const { team, lead, sprint2, actionItem } = await carriedActionItem();
    await db.actionItem.update({
      where: { id: actionItem.id },
      data: { isDone: true },
    });
    signInAs(lead);

    // Act
    const res = await updateActionItem(team.id, sprint2.id, actionItem.id, {
      isDone: false,
    });

    // Assert
    expect(res.status).toBe(200);
    expect((await res.json()).isDone).toBe(false);
  });

  it("returns 404 for an action item carried into another sprint", async () => {
    // Arrange: the item belongs to Sprint 2, not to Sprint 1 where it came from
    const { team, member, sprint1, actionItem } = await carriedActionItem();
    signInAs(member);

    // Act
    const res = await updateActionItem(team.id, sprint1.id, actionItem.id, {
      isDone: true,
    });

    // Assert
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      error: {
        code: "ACTION_ITEM_NOT_FOUND",
        message: "Action item not found.",
      },
    });
  });

  it("refuses changes once the sprint's own retro is closed", async () => {
    // Arrange
    const { team, member, sprint2, actionItem } = await carriedActionItem();
    await insertRetro({ sprintId: sprint2.id, closedAt: new Date() });
    signInAs(member);

    // Act
    const res = await updateActionItem(team.id, sprint2.id, actionItem.id, {
      isDone: true,
    });

    // Assert
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: {
        code: "RETRO_CLOSED",
        message:
          "This sprint's retro is closed, so its action items can't change.",
      },
    });
  });

  it("refuses an instructor", async () => {
    // Arrange
    const { team, instructor, sprint2, actionItem } = await carriedActionItem();
    signInAs(instructor);

    // Act
    const res = await updateActionItem(team.id, sprint2.id, actionItem.id, {
      isDone: true,
    });

    // Assert
    expect(res.status).toBe(403);
  });

  it("returns 400 when isDone isn't a boolean", async () => {
    // Arrange
    const { team, member, sprint2, actionItem } = await carriedActionItem();
    signInAs(member);

    // Act
    const res = await updateActionItem(team.id, sprint2.id, actionItem.id, {
      isDone: "yes",
    });

    // Assert
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("VALIDATION_ERROR");
  });
});
