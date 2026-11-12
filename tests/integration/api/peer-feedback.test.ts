import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import { getSessionUserId } from "@/server/auth-session";
import { triggerTeamEvent } from "@/server/realtime";
import { GET as listFeedbackRoute } from "@/app/api/v1/teams/[teamId]/sprints/[sprintId]/peer-feedback/route";
import { PUT as saveFeedbackRoute } from "@/app/api/v1/teams/[teamId]/sprints/[sprintId]/peer-feedback/[recipientId]/route";
import { GET as getRetroRoute } from "@/app/api/v1/teams/[teamId]/sprints/[sprintId]/retro/route";
import { GET as getSummaryRoute } from "@/app/api/v1/teams/[teamId]/sprints/[sprintId]/summary/route";
import { GET as getTeamRoute } from "@/app/api/v1/teams/[teamId]/route";
import {
  insertMembership,
  insertPeerFeedback,
  insertRetro,
  insertSprint,
  insertTeam,
  insertUser,
} from "../../factories/db";
import { apiGetRequest, apiRequest, routeContext } from "../helpers/requests";
import { clearDatabase } from "../setup/test-setup";

// Integration tests mock external services at their wrappers (AGENTS.md §1 Testing).
vi.mock("@/server/auth-session", () => ({ getSessionUserId: vi.fn() }));
vi.mock("@/server/realtime", () => ({ triggerTeamEvent: vi.fn() }));

type User = Awaited<ReturnType<typeof insertUser>>;

function signInAs(user: User | null) {
  vi.mocked(getSessionUserId).mockResolvedValue(user?.id ?? null);
}

// A team with a lead, a member and an instructor. Sprint 1's retro is open;
// Sprint 2 has none yet.
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
  await insertRetro({ sprintId: sprint1.id });
  return { team, lead, member, instructor, sprint1, sprint2 };
}

function feedbackPath(teamId: string, sprintId: string): string {
  return `/teams/${teamId}/sprints/${sprintId}/peer-feedback`;
}

function saveFeedback(
  teamId: string,
  sprintId: string,
  recipientId: string,
  body: unknown
) {
  return saveFeedbackRoute(
    apiRequest("PUT", `${feedbackPath(teamId, sprintId)}/${recipientId}`, body),
    routeContext({ teamId, sprintId, recipientId })
  );
}

function listFeedback(teamId: string, sprintId: string, query = "") {
  return listFeedbackRoute(
    apiGetRequest(`${feedbackPath(teamId, sprintId)}${query}`),
    routeContext({ teamId, sprintId })
  );
}

function person(user: User) {
  return { userId: user.id, name: user.name, githubLogin: user.githubLogin };
}

const FEEDBACK_ABOUT_LEAD =
  "Ziqi explains decisions well in PR descriptions. A few of my PRs waited more than a day for review.";
const FEEDBACK_ABOUT_MEMBER =
  "Your reviews caught things I missed. Let's write what we checked in every approval.";

const PEER_FEEDBACK_NOT_FOUND = {
  error: {
    code: "PEER_FEEDBACK_NOT_FOUND",
    message: "Peer feedback not found.",
  },
};

const TEAMMATE_NOT_FOUND = {
  error: {
    code: "TEAMMATE_NOT_FOUND",
    message:
      "Teammate not found. Feedback is about another lead or member of this team.",
  },
};

beforeEach(async () => {
  await clearDatabase();
  vi.mocked(getSessionUserId).mockReset();
  vi.mocked(triggerTeamEvent).mockReset();
});

describe("PUT /api/v1/teams/{teamId}/sprints/{sprintId}/peer-feedback/{recipientId}", () => {
  it("lets a member save feedback about a teammate while the retro is open", async () => {
    // Arrange
    const { team, lead, member, sprint1 } = await setUpTeam();
    signInAs(member);

    // Act
    const res = await saveFeedback(team.id, sprint1.id, lead.id, {
      text: FEEDBACK_ABOUT_LEAD,
    });

    // Assert: the author gets their own entry back
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      id: expect.any(String),
      sprintId: sprint1.id,
      author: person(member),
      recipient: person(lead),
      text: FEEDBACK_ABOUT_LEAD,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    const stored = await db.peerFeedback.findMany();
    expect(stored).toEqual([
      expect.objectContaining({
        sprintId: sprint1.id,
        authorId: member.id,
        recipientId: lead.id,
        text: FEEDBACK_ABOUT_LEAD,
      }),
    ]);
  });

  it("lets the lead save feedback about a teammate too", async () => {
    // Arrange
    const { team, lead, member, sprint1 } = await setUpTeam();
    signInAs(lead);

    // Act
    const res = await saveFeedback(team.id, sprint1.id, member.id, {
      text: FEEDBACK_ABOUT_MEMBER,
    });

    // Assert
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      author: person(lead),
      recipient: person(member),
      text: FEEDBACK_ABOUT_MEMBER,
    });
  });

  it("updates the entry when the author saves again, so there's one per teammate per sprint", async () => {
    // Arrange
    const { team, lead, member, sprint1 } = await setUpTeam();
    const earlier = await insertPeerFeedback({
      sprintId: sprint1.id,
      authorId: member.id,
      recipientId: lead.id,
      text: "First draft.",
      createdAt: new Date("2026-11-03T17:00:00Z"),
      updatedAt: new Date("2026-11-03T17:00:00Z"),
    });
    signInAs(member);

    // Act
    const res = await saveFeedback(team.id, sprint1.id, lead.id, {
      text: FEEDBACK_ABOUT_LEAD,
    });

    // Assert
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ id: earlier.id, text: FEEDBACK_ABOUT_LEAD });
    expect(body.createdAt).toBe("2026-11-03T17:00:00.000Z");
    expect(new Date(body.updatedAt).getTime()).toBeGreaterThan(
      earlier.updatedAt.getTime()
    );
    const stored = await db.peerFeedback.findMany();
    expect(stored).toHaveLength(1);
    expect(stored[0].text).toBe(FEEDBACK_ABOUT_LEAD);
  });

  it("keeps a separate entry for each teammate and each sprint", async () => {
    // Arrange: a third member, and Sprint 2's retro open too
    const { team, lead, member, sprint1, sprint2 } = await setUpTeam();
    const maya = await insertUser({ name: "Maya" });
    await insertMembership({
      userId: maya.id,
      teamId: team.id,
      role: "MEMBER",
    });
    await insertRetro({ sprintId: sprint2.id });
    signInAs(member);

    // Act
    const responses = [
      await saveFeedback(team.id, sprint1.id, lead.id, { text: "About Ziqi." }),
      await saveFeedback(team.id, sprint1.id, maya.id, { text: "About Maya." }),
      await saveFeedback(team.id, sprint2.id, lead.id, {
        text: "About Ziqi, Sprint 2.",
      }),
    ];

    // Assert
    expect(responses.map((res) => res.status)).toEqual([200, 200, 200]);
    const stored = await db.peerFeedback.findMany({
      where: { authorId: member.id },
      select: { sprintId: true, recipientId: true, text: true },
    });
    expect(stored).toEqual(
      expect.arrayContaining([
        { sprintId: sprint1.id, recipientId: lead.id, text: "About Ziqi." },
        { sprintId: sprint1.id, recipientId: maya.id, text: "About Maya." },
        {
          sprintId: sprint2.id,
          recipientId: lead.id,
          text: "About Ziqi, Sprint 2.",
        },
      ])
    );
    expect(stored).toHaveLength(3);
  });

  it("trims spaces around the text", async () => {
    // Arrange
    const { team, lead, member, sprint1 } = await setUpTeam();
    signInAs(member);

    // Act
    const res = await saveFeedback(team.id, sprint1.id, lead.id, {
      text: `  ${FEEDBACK_ABOUT_LEAD}\n `,
    });

    // Assert
    expect((await res.json()).text).toBe(FEEDBACK_ABOUT_LEAD);
  });

  it("returns only the author's own entry, never what the teammate wrote about them", async () => {
    // Arrange: the member already wrote about the lead
    const { team, lead, member, sprint1 } = await setUpTeam();
    await insertPeerFeedback({
      sprintId: sprint1.id,
      authorId: member.id,
      recipientId: lead.id,
      text: FEEDBACK_ABOUT_LEAD,
    });
    signInAs(lead);

    // Act
    const res = await saveFeedback(team.id, sprint1.id, member.id, {
      text: FEEDBACK_ABOUT_MEMBER,
    });

    // Assert
    const raw = await res.text();
    expect(raw).toContain(FEEDBACK_ABOUT_MEMBER);
    expect(raw).not.toContain(FEEDBACK_ABOUT_LEAD);
  });

  it("refuses changes once the retro is closed, keeping the saved text", async () => {
    // Arrange
    const team = await insertTeam();
    const lead = await insertUser();
    const member = await insertUser();
    await insertMembership({ userId: lead.id, teamId: team.id, role: "LEAD" });
    await insertMembership({
      userId: member.id,
      teamId: team.id,
      role: "MEMBER",
    });
    const sprint = await insertSprint({ teamId: team.id });
    await insertRetro({
      sprintId: sprint.id,
      closedAt: new Date("2026-11-04T20:00:00Z"),
    });
    await insertPeerFeedback({
      sprintId: sprint.id,
      authorId: member.id,
      recipientId: lead.id,
      text: "Saved before the retro closed.",
    });
    signInAs(member);

    // Act
    const res = await saveFeedback(team.id, sprint.id, lead.id, {
      text: "Changed after it closed.",
    });

    // Assert
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: {
        code: "RETRO_CLOSED",
        message:
          "This sprint's retro is closed, so its partner feedback can't change.",
      },
    });
    const stored = await db.peerFeedback.findFirstOrThrow();
    expect(stored.text).toBe("Saved before the retro closed.");
  });

  it("refuses feedback before the lead opens the retro", async () => {
    // Arrange: Sprint 2 has no retro
    const { team, lead, member, sprint2 } = await setUpTeam();
    signInAs(member);

    // Act
    const res = await saveFeedback(team.id, sprint2.id, lead.id, {
      text: FEEDBACK_ABOUT_LEAD,
    });

    // Assert
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      error: {
        code: "RETRO_NOT_FOUND",
        message: "The lead hasn't opened this sprint's retro yet.",
      },
    });
    expect(await db.peerFeedback.count()).toBe(0);
  });

  it.each([
    ["yourself", "self"],
    ["the team's instructor", "instructor"],
    ["someone who isn't on the team", "outsider"],
    ["a user that doesn't exist", "missing"],
  ] as const)("refuses feedback about %s", async (_label, who) => {
    // Arrange
    const { team, member, instructor, sprint1 } = await setUpTeam();
    const outsider = await insertUser();
    const recipientIds = {
      self: member.id,
      instructor: instructor.id,
      outsider: outsider.id,
      missing: "user-that-does-not-exist",
    };
    signInAs(member);

    // Act
    const res = await saveFeedback(team.id, sprint1.id, recipientIds[who], {
      text: "Feedback.",
    });

    // Assert
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual(TEAMMATE_NOT_FOUND);
    expect(await db.peerFeedback.count()).toBe(0);
  });

  it("refuses an instructor, who reads feedback but doesn't write it", async () => {
    // Arrange
    const { team, lead, instructor, sprint1 } = await setUpTeam();
    signInAs(instructor);

    // Act
    const res = await saveFeedback(team.id, sprint1.id, lead.id, {
      text: "Feedback.",
    });

    // Assert
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe("FORBIDDEN");
    expect(await db.peerFeedback.count()).toBe(0);
  });

  it("refuses someone who isn't on the team", async () => {
    // Arrange
    const { team, lead, sprint1 } = await setUpTeam();
    signInAs(await insertUser());

    // Act
    const res = await saveFeedback(team.id, sprint1.id, lead.id, {
      text: "Feedback.",
    });

    // Assert
    expect(res.status).toBe(403);
    expect(await db.peerFeedback.count()).toBe(0);
  });

  it("asks a signed-out caller to sign in", async () => {
    // Arrange
    const { team, lead, sprint1 } = await setUpTeam();
    signInAs(null);

    // Act
    const res = await saveFeedback(team.id, sprint1.id, lead.id, {
      text: "Feedback.",
    });

    // Assert
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("UNAUTHENTICATED");
  });

  it("refuses a sprint of another team", async () => {
    // Arrange
    const { team, lead, member } = await setUpTeam();
    const otherTeam = await insertTeam();
    const otherSprint = await insertSprint({ teamId: otherTeam.id });
    await insertRetro({ sprintId: otherSprint.id });
    signInAs(member);

    // Act
    const res = await saveFeedback(team.id, otherSprint.id, lead.id, {
      text: "Feedback.",
    });

    // Assert
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("SPRINT_NOT_FOUND");
    expect(await db.peerFeedback.count()).toBe(0);
  });

  it.each([
    [{ text: "" }, "Write your feedback first."],
    [{ text: "  \n " }, "Write your feedback first."],
    [{}, "Write your feedback first."],
    [{ text: "a".repeat(1001) }, "Use 1000 characters or fewer."],
    [{ text: "bad\u0000text" }, "Text cannot contain a NUL character."],
  ])("refuses the body %j", async (body, message) => {
    // Arrange
    const { team, lead, member, sprint1 } = await setUpTeam();
    signInAs(member);

    // Act
    const res = await saveFeedback(team.id, sprint1.id, lead.id, body);

    // Assert
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: { code: "VALIDATION_ERROR", message },
    });
    expect(await db.peerFeedback.count()).toBe(0);
  });

  it("sends nothing on the team channel, so teammates' pages don't learn feedback was saved", async () => {
    // Arrange
    const { team, lead, member, sprint1 } = await setUpTeam();
    signInAs(member);

    // Act
    const res = await saveFeedback(team.id, sprint1.id, lead.id, {
      text: FEEDBACK_ABOUT_LEAD,
    });

    // Assert
    expect(res.status).toBe(200);
    expect(triggerTeamEvent).not.toHaveBeenCalled();
  });
});

describe("GET /api/v1/teams/{teamId}/sprints/{sprintId}/peer-feedback", () => {
  it("lists the sprint's feedback for an instructor, with authors and teammates", async () => {
    // Arrange
    const { team, lead, member, instructor, sprint1, sprint2 } =
      await setUpTeam();
    const aboutLead = await insertPeerFeedback({
      sprintId: sprint1.id,
      authorId: member.id,
      recipientId: lead.id,
      text: FEEDBACK_ABOUT_LEAD,
      createdAt: new Date("2026-11-03T17:00:00Z"),
      updatedAt: new Date("2026-11-03T18:00:00Z"),
    });
    const aboutMember = await insertPeerFeedback({
      sprintId: sprint1.id,
      authorId: lead.id,
      recipientId: member.id,
      text: FEEDBACK_ABOUT_MEMBER,
      createdAt: new Date("2026-11-04T17:00:00Z"),
      updatedAt: new Date("2026-11-04T17:00:00Z"),
    });
    // Another sprint's feedback isn't listed.
    await insertPeerFeedback({
      sprintId: sprint2.id,
      authorId: member.id,
      recipientId: lead.id,
      text: "Sprint 2 feedback.",
    });
    signInAs(instructor);

    // Act
    const res = await listFeedback(team.id, sprint1.id);

    // Assert: oldest first
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      data: [
        {
          id: aboutLead.id,
          sprintId: sprint1.id,
          author: person(member),
          recipient: person(lead),
          text: FEEDBACK_ABOUT_LEAD,
          createdAt: "2026-11-03T17:00:00.000Z",
          updatedAt: "2026-11-03T18:00:00.000Z",
        },
        {
          id: aboutMember.id,
          sprintId: sprint1.id,
          author: person(lead),
          recipient: person(member),
          text: FEEDBACK_ABOUT_MEMBER,
          createdAt: "2026-11-04T17:00:00.000Z",
          updatedAt: "2026-11-04T17:00:00.000Z",
        },
      ],
      nextCursor: null,
    });
  });

  it("lists nothing for a sprint without feedback", async () => {
    // Arrange
    const { team, instructor, sprint2 } = await setUpTeam();
    signInAs(instructor);

    // Act
    const res = await listFeedback(team.id, sprint2.id);

    // Assert
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: [], nextCursor: null });
  });

  it.each(["member", "lead"] as const)(
    "is not found for the team's %s, even for feedback they wrote (rule R7)",
    async (role) => {
      // Arrange: both wrote feedback about each other
      const { team, sprint1, ...users } = await setUpTeam();
      await insertPeerFeedback({
        sprintId: sprint1.id,
        authorId: users.member.id,
        recipientId: users.lead.id,
        text: FEEDBACK_ABOUT_LEAD,
      });
      await insertPeerFeedback({
        sprintId: sprint1.id,
        authorId: users.lead.id,
        recipientId: users.member.id,
        text: FEEDBACK_ABOUT_MEMBER,
      });
      signInAs(users[role]);

      // Act
      const res = await listFeedback(team.id, sprint1.id);

      // Assert: the same answer as feedback that doesn't exist
      expect(res.status).toBe(404);
      const raw = await res.text();
      expect(JSON.parse(raw)).toEqual(PEER_FEEDBACK_NOT_FOUND);
      expect(raw).not.toContain(FEEDBACK_ABOUT_LEAD);
      expect(raw).not.toContain(FEEDBACK_ABOUT_MEMBER);
    }
  );

  it.each(["member", "lead"] as const)(
    "is not found for the team's %s on a sprint that doesn't exist either",
    async (role) => {
      // Arrange
      const { team, ...users } = await setUpTeam();
      signInAs(users[role]);

      // Act
      const res = await listFeedback(team.id, "sprint-that-does-not-exist");

      // Assert
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual(PEER_FEEDBACK_NOT_FOUND);
    }
  );

  it("is not found for an instructor of another team", async () => {
    // Arrange
    const { team, lead, member, sprint1 } = await setUpTeam();
    await insertPeerFeedback({
      sprintId: sprint1.id,
      authorId: member.id,
      recipientId: lead.id,
      text: FEEDBACK_ABOUT_LEAD,
    });
    const otherTeam = await insertTeam();
    const otherInstructor = await insertUser({ name: "Another TA" });
    await insertMembership({
      userId: otherInstructor.id,
      teamId: otherTeam.id,
      role: "INSTRUCTOR",
    });
    signInAs(otherInstructor);

    // Act
    const res = await listFeedback(team.id, sprint1.id);

    // Assert
    expect(res.status).toBe(404);
    const raw = await res.text();
    expect(JSON.parse(raw)).toEqual(PEER_FEEDBACK_NOT_FOUND);
    expect(raw).not.toContain(FEEDBACK_ABOUT_LEAD);
  });

  it("is not found for an instructor asking for another team's sprint through their own team", async () => {
    // Arrange: the other team's sprint has feedback
    const { team, instructor } = await setUpTeam();
    const otherTeam = await insertTeam();
    const author = await insertUser();
    const recipient = await insertUser();
    const otherSprint = await insertSprint({ teamId: otherTeam.id });
    await insertPeerFeedback({
      sprintId: otherSprint.id,
      authorId: author.id,
      recipientId: recipient.id,
      text: "Another team's feedback.",
    });
    signInAs(instructor);

    // Act
    const res = await listFeedback(team.id, otherSprint.id);

    // Assert
    expect(res.status).toBe(404);
    const raw = await res.text();
    expect(JSON.parse(raw).error.code).toBe("SPRINT_NOT_FOUND");
    expect(raw).not.toContain("Another team's feedback.");
  });

  it("is not found for someone who isn't on the team", async () => {
    // Arrange
    const { team, sprint1 } = await setUpTeam();
    signInAs(await insertUser());

    // Act
    const res = await listFeedback(team.id, sprint1.id);

    // Assert
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual(PEER_FEEDBACK_NOT_FOUND);
  });

  it("asks a signed-out caller to sign in", async () => {
    // Arrange
    const { team, sprint1 } = await setUpTeam();
    signInAs(null);

    // Act
    const res = await listFeedback(team.id, sprint1.id);

    // Assert
    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe("UNAUTHENTICATED");
  });

  it("pages through the feedback with ?limit= and ?cursor=", async () => {
    // Arrange
    const { team, lead, member, instructor, sprint1 } = await setUpTeam();
    const first = await insertPeerFeedback({
      sprintId: sprint1.id,
      authorId: member.id,
      recipientId: lead.id,
      createdAt: new Date("2026-11-03T17:00:00Z"),
    });
    const second = await insertPeerFeedback({
      sprintId: sprint1.id,
      authorId: lead.id,
      recipientId: member.id,
      createdAt: new Date("2026-11-04T17:00:00Z"),
    });
    signInAs(instructor);

    // Act
    const firstPage = await (
      await listFeedback(team.id, sprint1.id, "?limit=1")
    ).json();
    const secondPage = await (
      await listFeedback(
        team.id,
        sprint1.id,
        `?limit=1&cursor=${firstPage.nextCursor}`
      )
    ).json();

    // Assert
    expect(firstPage.data.map((entry: { id: string }) => entry.id)).toEqual([
      first.id,
    ]);
    expect(firstPage.nextCursor).toBe(first.id);
    expect(secondPage.data.map((entry: { id: string }) => entry.id)).toEqual([
      second.id,
    ]);
    expect(secondPage.nextCursor).toBeNull();
  });

  it("refuses a cursor that isn't from this list", async () => {
    // Arrange
    const { team, lead, member, instructor, sprint1, sprint2 } =
      await setUpTeam();
    const otherSprintEntry = await insertPeerFeedback({
      sprintId: sprint2.id,
      authorId: member.id,
      recipientId: lead.id,
    });
    signInAs(instructor);

    // Act
    const res = await listFeedback(
      team.id,
      sprint1.id,
      `?cursor=${otherSprintEntry.id}`
    );

    // Assert
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("INVALID_CURSOR");
  });

  it("refuses a limit outside 1–100", async () => {
    // Arrange
    const { team, instructor, sprint1 } = await setUpTeam();
    signInAs(instructor);

    // Act
    const res = await listFeedback(team.id, sprint1.id, "?limit=0");

    // Assert
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("VALIDATION_ERROR");
  });
});

describe("peer feedback in other responses (rule R7)", () => {
  it("never shows up in the retro, the sprint summary or the team for a member", async () => {
    // Arrange: feedback about the member
    const { team, lead, member, sprint1 } = await setUpTeam();
    await insertPeerFeedback({
      sprintId: sprint1.id,
      authorId: lead.id,
      recipientId: member.id,
      text: FEEDBACK_ABOUT_MEMBER,
    });
    signInAs(member);
    const context = routeContext({ teamId: team.id, sprintId: sprint1.id });

    // Act
    const responses = [
      await getRetroRoute(
        apiGetRequest(`/teams/${team.id}/sprints/${sprint1.id}/retro`),
        context
      ),
      await getSummaryRoute(
        apiGetRequest(`/teams/${team.id}/sprints/${sprint1.id}/summary`),
        context
      ),
      await getTeamRoute(
        apiGetRequest(`/teams/${team.id}`),
        routeContext({ teamId: team.id })
      ),
    ];

    // Assert
    for (const res of responses) {
      expect(res.status).toBe(200);
      expect(await res.text()).not.toContain(FEEDBACK_ABOUT_MEMBER);
    }
  });
});
