import { z } from "zod";
import { updateActionItemSchema } from "@/lib/retro/retro-input";
import {
  accessDeniedResponse,
  catchUnexpectedErrors,
  parseInput,
  parseJsonBody,
  sprintNotFoundResponse,
} from "@/server/api-response";
import { requireTeamRole } from "@/server/auth";
import { triggerTeamEvent } from "@/server/realtime";
import { setActionItemDone } from "@/server/repositories/retros";
import { findSprintById } from "@/server/repositories/sprints";
import {
  retroErrorResponse,
  toActionItemResponse,
} from "@/server/retro-response";

const paramsSchema = z.object({
  teamId: z.string().min(1),
  sprintId: z.string().min(1),
  actionItemId: z.string().min(1),
});

interface Context {
  params: Promise<{ teamId: string; sprintId: string; actionItemId: string }>;
}

// PATCH: Checks an action item carried into this sprint off, or unchecks it,
// until this sprint's own retro closes. Leads and members only.
export async function PATCH(request: Request, context: Context) {
  return catchUnexpectedErrors({
    route:
      "PATCH /api/v1/teams/{teamId}/sprints/{sprintId}/retro/action-items/{actionItemId}",
    handler: () => handlePatch(request, context),
  });
}

async function handlePatch(request: Request, { params }: Context) {
  const parsedParams = parseInput({
    input: await params,
    schema: paramsSchema,
  });
  if (!parsedParams.isValid) {
    return parsedParams.response;
  }
  const { teamId, sprintId, actionItemId } = parsedParams.data;
  const access = await requireTeamRole(teamId, ["LEAD", "MEMBER"]);
  if (!access.isAllowed) {
    return accessDeniedResponse(access);
  }
  if ((await findSprintById({ teamId, sprintId })) === null) {
    return sprintNotFoundResponse();
  }
  const parsedBody = await parseJsonBody({
    request,
    schema: updateActionItemSchema,
  });
  if (!parsedBody.isValid) {
    return parsedBody.response;
  }
  const result = await setActionItemDone({
    sprintId,
    actionItemId,
    isDone: parsedBody.data.isDone,
  });
  if (result.status !== "SAVED") {
    return retroErrorResponse(
      result.status === "RETRO_CLOSED"
        ? "ACTION_ITEMS_CLOSED"
        : "ACTION_ITEM_NOT_FOUND"
    );
  }
  await triggerTeamEvent({ teamId, event: "retro.updated" });
  return Response.json(toActionItemResponse(result.actionItem));
}
