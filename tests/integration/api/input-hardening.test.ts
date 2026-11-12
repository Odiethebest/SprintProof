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
import { POST as rotateWebhookSecret } from "@/app/api/v1/teams/[teamId]/webhook-secret/route";
import { insertUser, insertTeam, insertMembership } from "../../factories/db";
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
      () => rotateWebhookSecret(apiRequest("POST", "/", undefined), context),
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
