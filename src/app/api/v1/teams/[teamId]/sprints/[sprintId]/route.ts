import { z } from "zod";
import {
  updateSprintSchema,
  validateSprint,
  type SprintInput,
} from "@/lib/sprints";
import {
  accessDeniedResponse,
  errorResponse,
  parseInput,
  parseJsonBody,
} from "@/server/api-response";
import { requireTeamRole } from "@/server/auth";
import {
  findSprintById,
  listSprints,
  updateSprint,
} from "@/server/repositories/sprints";

const paramsSchema = z.object({
  teamId: z.string().min(1),
  sprintId: z.string().min(1),
});

// PATCH: Updates a sprint. Lead only. Fields left out keep their stored value.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ teamId: string; sprintId: string }> }
) {
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
  const changes = parsedBody.data;
  const sprintInput: SprintInput = {
    id: sprintId,
    name: changes.name ?? existingSprint.name,
    startDate: changes.startDate ?? existingSprint.startDate,
    endDate: changes.endDate ?? existingSprint.endDate,
    standupsPerPerson:
      changes.standupsPerPerson ?? existingSprint.standupsPerPerson,
    reviewsPerPerson:
      changes.reviewsPerPerson ?? existingSprint.reviewsPerPerson,
  };

  const existingSprints = await listSprints({ teamId });
  const errors = validateSprint({ sprint: sprintInput, existingSprints });
  if (errors.length > 0) {
    return errorResponse({
      status: 400,
      code: "VALIDATION_ERROR",
      message: errors[0].message,
    });
  }

  const updated = await updateSprint({ teamId, sprintId, ...sprintInput });
  return Response.json(updated, { status: 200 });
}
