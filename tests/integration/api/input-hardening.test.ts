import { beforeEach, expect, it, vi } from "vitest";
import { getSessionUserId } from "@/server/auth-session";
import {
  GET as listSprints,
  POST as createSprint,
} from "@/app/api/v1/teams/[teamId]/sprints/route";
import { PATCH as editSprint } from "@/app/api/v1/teams/[teamId]/sprints/[sprintId]/route";
import { GET as summary } from "@/app/api/v1/teams/[teamId]/sprints/[sprintId]/summary/route";
import { GET as standups } from "@/app/api/v1/teams/[teamId]/sprints/[sprintId]/standups/route";
import { POST as createInvite } from "@/app/api/v1/teams/[teamId]/invites/route";
import { DELETE as revokeInvite } from "@/app/api/v1/teams/[teamId]/invites/[inviteId]/route";
import { DELETE as revokeToken } from "@/app/api/v1/tokens/[tokenId]/route";
import { POST as postStandup } from "@/app/api/v1/teams/[teamId]/standups/route";
import { POST as createTeam } from "@/app/api/v1/teams/route";
import { POST as createToken } from "@/app/api/v1/tokens/route";
import { POST as join } from "@/app/api/v1/memberships/route";
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
import {
  insertUser,
  insertTeam,
  insertMembership,
  insertRetro,
  insertSprint,
} from "../../factories/db";
import {
  createTeamInput,
  createSprintInput,
  createStandupInput,
} from "../../factories/validation-inputs";
import { apiRequest, routeContext } from "../helpers/requests";
import { clearDatabase } from "../setup/test-setup";
vi.mock("@/server/auth-session", () => ({ getSessionUserId: vi.fn() }));
vi.mock("@/server/realtime", () => ({ triggerTeamEvent: vi.fn() }));
beforeEach(clearDatabase);

it("treats NUL URL ids exactly like unknown ids across all routes", async () => {
  const user = await insertUser();
  const team = await insertTeam();
  await insertMembership({ userId: user.id, teamId: team.id, role: "LEAD" });
  vi.mocked(getSessionUserId).mockResolvedValue(user.id);
  for (const teamId of ["missing", "bad\u0000id"]) {
    const context = routeContext({ teamId });
    for (const run of [
      () => listSprints(apiRequest("GET", "/", undefined), context),
      () => createSprint(apiRequest("POST", "/", createSprintInput()), context),
      () => createInvite(apiRequest("POST", "/", { role: "MEMBER" }), context),
      () => postStandup(apiRequest("POST", "/", createStandupInput()), context),
    ])
      expect((await run()).status).toBe(403);
  }
  for (const id of ["missing", "bad\u0000id"]) {
    const sprintContext = routeContext({ teamId: team.id, sprintId: id });
    for (const run of [
      () => editSprint(apiRequest("PATCH", "/", {}), sprintContext),
      () => summary(apiRequest("GET", "/", undefined), sprintContext),
      () => standups(apiRequest("GET", "/", undefined), sprintContext),
      () =>
        revokeInvite(
          apiRequest("DELETE", "/", undefined),
          routeContext({ teamId: team.id, inviteId: id })
        ),
      () =>
        revokeToken(
          apiRequest("DELETE", "/", undefined),
          routeContext({ tokenId: id })
        ),
    ])
      expect((await run()).status).toBe(404);
  }
});
it("returns structured validation errors for NUL user text", async () => {
  const user = await insertUser();
  const team = await insertTeam();
  await insertMembership({ userId: user.id, teamId: team.id, role: "LEAD" });
  vi.mocked(getSessionUserId).mockResolvedValue(user.id);
  for (const run of [
    () =>
      createTeam(
        apiRequest("POST", "/", createTeamInput({ name: "bad\u0000" }))
      ),
    () => createToken(apiRequest("POST", "/", { name: "bad\u0000" })),
    () =>
      createSprint(
        apiRequest("POST", "/", createSprintInput({ name: "bad\u0000" })),
        routeContext({ teamId: team.id })
      ),
    () =>
      postStandup(
        apiRequest("POST", "/", createStandupInput({ today: "bad\u0000" })),
        routeContext({ teamId: team.id })
      ),
    () => join(apiRequest("POST", "/", { inviteToken: "bad\u0000" })),
  ]) {
    const response = await run();
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { code: "VALIDATION_ERROR" },
    });
  }
});
it("treats NUL retro ids exactly like unknown ids (#13)", async () => {
  const user = await insertUser();
  const team = await insertTeam();
  await insertMembership({ userId: user.id, teamId: team.id, role: "LEAD" });
  const sprint = await insertSprint({ teamId: team.id });
  await insertRetro({ sprintId: sprint.id });
  vi.mocked(getSessionUserId).mockResolvedValue(user.id);
  const item = { column: "WENT_WELL", text: "Something" };
  for (const teamId of ["missing", "bad\u0000id"]) {
    const context = routeContext({ teamId, sprintId: sprint.id });
    for (const run of [
      () => getRetro(apiRequest("GET", "/"), context),
      () => openRetro(apiRequest("POST", "/"), context),
      () => addRetroItem(apiRequest("POST", "/", item), context),
    ])
      expect((await run()).status).toBe(403);
  }
  for (const id of ["missing", "bad\u0000id"]) {
    const sprintContext = routeContext({ teamId: team.id, sprintId: id });
    for (const run of [
      () => getRetro(apiRequest("GET", "/"), sprintContext),
      () => openRetro(apiRequest("POST", "/"), sprintContext),
      () =>
        closeRetro(
          apiRequest("PATCH", "/", { status: "CLOSED" }),
          sprintContext
        ),
      () => addRetroItem(apiRequest("POST", "/", item), sprintContext),
      () =>
        voteRetroItem(
          apiRequest("PUT", "/"),
          routeContext({ teamId: team.id, sprintId: sprint.id, itemId: id })
        ),
      () =>
        unvoteRetroItem(
          apiRequest("DELETE", "/"),
          routeContext({ teamId: team.id, sprintId: sprint.id, itemId: id })
        ),
      () =>
        updateActionItem(
          apiRequest("PATCH", "/", { isDone: true }),
          routeContext({
            teamId: team.id,
            sprintId: sprint.id,
            actionItemId: id,
          })
        ),
    ])
      expect((await run()).status).toBe(404);
  }
});
it("returns a structured validation error for NUL in a retro item (#13)", async () => {
  const user = await insertUser();
  const team = await insertTeam();
  await insertMembership({ userId: user.id, teamId: team.id, role: "LEAD" });
  const sprint = await insertSprint({ teamId: team.id });
  await insertRetro({ sprintId: sprint.id });
  vi.mocked(getSessionUserId).mockResolvedValue(user.id);
  const response = await addRetroItem(
    apiRequest("POST", "/", { column: "WENT_WELL", text: "bad\u0000" }),
    routeContext({ teamId: team.id, sprintId: sprint.id })
  );
  expect(response.status).toBe(400);
  expect(await response.json()).toMatchObject({
    error: { code: "VALIDATION_ERROR" },
  });
});
it("treats NUL peer feedback ids exactly like unknown ids (#14)", async () => {
  const lead = await insertUser();
  const member = await insertUser();
  const instructor = await insertUser();
  const team = await insertTeam();
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
  const sprint = await insertSprint({ teamId: team.id });
  await insertRetro({ sprintId: sprint.id });
  const body = { text: "Reviews were thorough." };
  for (const teamId of ["missing", "bad\u0000id"]) {
    const context = { teamId, sprintId: sprint.id };
    vi.mocked(getSessionUserId).mockResolvedValue(instructor.id);
    // Anyone who can't read feedback gets 404, the same as no feedback.
    expect(
      (await listPeerFeedback(apiRequest("GET", "/"), routeContext(context)))
        .status
    ).toBe(404);
    vi.mocked(getSessionUserId).mockResolvedValue(lead.id);
    expect(
      (
        await savePeerFeedback(
          apiRequest("PUT", "/", body),
          routeContext({ ...context, recipientId: member.id })
        )
      ).status
    ).toBe(403);
  }
  for (const id of ["missing", "bad\u0000id"]) {
    vi.mocked(getSessionUserId).mockResolvedValue(instructor.id);
    expect(
      (
        await listPeerFeedback(
          apiRequest("GET", "/"),
          routeContext({ teamId: team.id, sprintId: id })
        )
      ).status
    ).toBe(404);
    vi.mocked(getSessionUserId).mockResolvedValue(lead.id);
    for (const context of [
      { teamId: team.id, sprintId: id, recipientId: member.id },
      { teamId: team.id, sprintId: sprint.id, recipientId: id },
    ]) {
      expect(
        (
          await savePeerFeedback(
            apiRequest("PUT", "/", body),
            routeContext(context)
          )
        ).status
      ).toBe(404);
    }
  }
});
it("returns a structured validation error for NUL in peer feedback (#14)", async () => {
  const lead = await insertUser();
  const member = await insertUser();
  const team = await insertTeam();
  await insertMembership({ userId: lead.id, teamId: team.id, role: "LEAD" });
  await insertMembership({
    userId: member.id,
    teamId: team.id,
    role: "MEMBER",
  });
  const sprint = await insertSprint({ teamId: team.id });
  await insertRetro({ sprintId: sprint.id });
  vi.mocked(getSessionUserId).mockResolvedValue(lead.id);
  const response = await savePeerFeedback(
    apiRequest("PUT", "/", { text: "bad\u0000" }),
    routeContext({
      teamId: team.id,
      sprintId: sprint.id,
      recipientId: member.id,
    })
  );
  expect(response.status).toBe(400);
  expect(await response.json()).toMatchObject({
    error: { code: "VALIDATION_ERROR" },
  });
});
