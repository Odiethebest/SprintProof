import { z } from "zod";
import { createRetroItemSchema } from "@/lib/retro/retro-input";
import {
  accessDeniedResponse,
  catchUnexpectedErrors,
  parseInput,
  parseJsonBody,
  sprintNotFoundResponse,
} from "@/server/api-response";
import { requireTeamRole } from "@/server/auth";
import { triggerTeamEvent } from "@/server/realtime";
import { addRetroItem } from "@/server/repositories/retros";
import { findSprintById } from "@/server/repositories/sprints";
import {
  retroErrorResponse,
  toRetroItemResponse,
} from "@/server/retro-response";

const paramsSchema = z.object({
  teamId: z.string().min(1),
  sprintId: z.string().min(1),
});

interface Context {
  params: Promise<{ teamId: string; sprintId: string }>;
}

// POST: Adds an item to "Went well" or "To improve" while the retro is open.
// Leads and members only: instructors read retros but don't add to them.
export async function POST(request: Request, context: Context) {
  return catchUnexpectedErrors({
    route: "POST /api/v1/teams/{teamId}/sprints/{sprintId}/retro/items",
    handler: () => handlePost(request, context),
  });
}

async function handlePost(request: Request, { params }: Context) {
  const parsedParams = parseInput({
    input: await params,
    schema: paramsSchema,
  });
  if (!parsedParams.isValid) {
    return parsedParams.response;
  }
  const { teamId, sprintId } = parsedParams.data;
  const access = await requireTeamRole(teamId, ["LEAD", "MEMBER"]);
  if (!access.isAllowed) {
    return accessDeniedResponse(access);
  }
  if ((await findSprintById({ teamId, sprintId })) === null) {
    return sprintNotFoundResponse();
  }
  const parsedBody = await parseJsonBody({
    request,
    schema: createRetroItemSchema,
  });
  if (!parsedBody.isValid) {
    return parsedBody.response;
  }
  const result = await addRetroItem({
    sprintId,
    authorId: access.userId,
    ...parsedBody.data,
  });
  if (result.status !== "ADDED") {
    return retroErrorResponse(result.status);
  }
  await triggerTeamEvent({ teamId, event: "retro.updated" });
  return Response.json(
    toRetroItemResponse({ ...result.item, voteCount: 0, hasVoted: false }),
    { status: 201 }
  );
}
