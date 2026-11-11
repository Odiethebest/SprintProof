import { z } from "zod";
import { updateSprintSchema } from "@/lib/sprints";
import {
  accessDeniedResponse,
  catchUnexpectedErrors,
  errorResponse,
  parseInput,
  parseJsonBody,
} from "@/server/api-response";
import { requireTeamRole } from "@/server/auth";
import {
  findSprintById,
  updateSprint,
  SprintValidationFailure,
} from "@/server/repositories/sprints";

const paramsSchema = z.object({
  teamId: z.string().min(1),
  sprintId: z.string().min(1),
});

interface Context {
  params: Promise<{ teamId: string; sprintId: string }>;
}

// PATCH: Updates a sprint. Lead only. Fields left out keep their stored value.
export async function PATCH(request: Request, context: Context) {
  return catchUnexpectedErrors({
    route: "PATCH /api/v1/teams/{teamId}/sprints/{sprintId}",
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
  const { teamId, sprintId } = parsedParams.data;
  const access = await requireTeamRole(teamId, ["LEAD"]);
  if (!access.isAllowed) {
    return accessDeniedResponse(access);
  }
  const existingSprint = await findSprintById({ teamId, sprintId });
  if (existingSprint === null) {
    return errorResponse({
      status: 404,
      code: "SPRINT_NOT_FOUND",
      message: "Sprint not found.",
    });
  }
  const parsedBody = await parseJsonBody({
    request,
    schema: updateSprintSchema,
  });
  if (!parsedBody.isValid) {
    return parsedBody.response;
  }
  try {
    const updated = await updateSprint({
      teamId,
      sprintId,
      ...parsedBody.data,
    });
    if (updated === null)
      return errorResponse({
        status: 404,
        code: "SPRINT_NOT_FOUND",
        message: "Sprint not found.",
      });
    return Response.json(updated, { status: 200 });
  } catch (error) {
    if (error instanceof SprintValidationFailure) {
      return errorResponse({
        status: 400,
        code: "VALIDATION_ERROR",
        message: error.message,
      });
    }
    throw error;
  }
}
