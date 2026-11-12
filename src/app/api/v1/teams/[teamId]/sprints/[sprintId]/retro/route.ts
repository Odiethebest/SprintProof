import { z } from "zod";
import { closeRetroSchema } from "@/lib/retro/retro-input";
import {
  accessDeniedResponse,
  catchUnexpectedErrors,
  parseInput,
  parseJsonBody,
  sprintNotFoundResponse,
} from "@/server/api-response";
import { requireTeamRole } from "@/server/auth";
import { triggerTeamEvent } from "@/server/realtime";
import { closeRetro, findRetro, openRetro } from "@/server/repositories/retros";
import { findSprintById } from "@/server/repositories/sprints";
import { retroErrorResponse, toRetroResponse } from "@/server/retro-response";

const paramsSchema = z.object({
  teamId: z.string().min(1),
  sprintId: z.string().min(1),
});

interface Context {
  params: Promise<{ teamId: string; sprintId: string }>;
}

// GET: The sprint's retro: items in vote order with the caller's votes, and the
// action items it made once closed. Anyone on the team, session only.
export async function GET(_request: Request, context: Context) {
  return catchUnexpectedErrors({
    route: "GET /api/v1/teams/{teamId}/sprints/{sprintId}/retro",
    handler: () => handleGet(context),
  });
}

// POST: Opens the sprint's retro (#13). Lead only.
export async function POST(_request: Request, context: Context) {
  return catchUnexpectedErrors({
    route: "POST /api/v1/teams/{teamId}/sprints/{sprintId}/retro",
    handler: () => handlePost(context),
  });
}

// PATCH: Closes the retro; its top 3 "To improve" items become the next
// sprint's action items (rule R6). Lead only.
export async function PATCH(request: Request, context: Context) {
  return catchUnexpectedErrors({
    route: "PATCH /api/v1/teams/{teamId}/sprints/{sprintId}/retro",
    handler: () => handlePatch(request, context),
  });
}

async function handleGet({ params }: Context) {
  const parsedParams = parseInput({
    input: await params,
    schema: paramsSchema,
  });
  if (!parsedParams.isValid) {
    return parsedParams.response;
  }
  const { teamId, sprintId } = parsedParams.data;
  const access = await requireTeamRole(teamId, [
    "LEAD",
    "MEMBER",
    "INSTRUCTOR",
  ]);
  if (!access.isAllowed) {
    return accessDeniedResponse(access);
  }
  if ((await findSprintById({ teamId, sprintId })) === null) {
    return sprintNotFoundResponse();
  }
  const retro = await findRetro({ sprintId });
  if (retro === null) {
    return retroErrorResponse("RETRO_NOT_FOUND");
  }
  return Response.json(
    toRetroResponse({
      retro,
      viewerId: access.userId,
      canVote: access.role !== "INSTRUCTOR",
    })
  );
}

async function handlePost({ params }: Context) {
  const parsedParams = parseInput({
    input: await params,
    schema: paramsSchema,
  });
  if (!parsedParams.isValid) {
    return parsedParams.response;
  }
  const { teamId, sprintId } = parsedParams.data;
  const access = await requireTeamRole(teamId, ["LEAD"]);
  if (!access.isAllowed) {
    return accessDeniedResponse(access);
  }
  if ((await findSprintById({ teamId, sprintId })) === null) {
    return sprintNotFoundResponse();
  }
  const retro = await openRetro({ sprintId });
  if (retro === null) {
    return retroErrorResponse("RETRO_EXISTS");
  }
  await triggerTeamEvent({ teamId, event: "retro.updated" });
  return Response.json(
    toRetroResponse({ retro, viewerId: access.userId, canVote: true }),
    { status: 201 }
  );
}

async function handlePatch(request: Request, { params }: Context) {
  const parsedParams = parseInput({
    input: await params,
    schema: paramsSchema,
  });
  if (!parsedParams.isValid) {
    return parsedParams.response;
  }
  const { teamId, sprintId } = parsedParams.data;
  const access = await requireTeamRole(teamId, ["LEAD"]);
  if (!access.isAllowed) {
    return accessDeniedResponse(access);
  }
  if ((await findSprintById({ teamId, sprintId })) === null) {
    return sprintNotFoundResponse();
  }
  const parsedBody = await parseJsonBody({ request, schema: closeRetroSchema });
  if (!parsedBody.isValid) {
    return parsedBody.response;
  }
  const result = await closeRetro({ teamId, sprintId, closedAt: new Date() });
  if (result.status !== "CLOSED") {
    return retroErrorResponse(result.status);
  }
  await triggerTeamEvent({ teamId, event: "retro.updated" });
  return Response.json(
    toRetroResponse({
      retro: result.retro,
      viewerId: access.userId,
      canVote: true,
    })
  );
}
