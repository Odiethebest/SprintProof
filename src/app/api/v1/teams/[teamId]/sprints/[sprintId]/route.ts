import { z } from "zod";
import { validateSprint, type SprintInput } from "@/lib/sprints";
import {
  accessDeniedResponse,
  errorResponse,
  parseInput,
  parseJsonBody,
  unauthenticatedResponse,
} from "@/server/api-response";
import { getSessionUserId } from "@/server/auth-session";
import { findMembershipRole } from "@/server/repositories/memberships";
import {
  findSprintById,
  listSprints,
  updateSprint,
} from "@/server/repositories/sprints";

const paramsSchema = z.object({
  teamId: z.string().min(1),
  sprintId: z.string().min(1),
});

// PATCH: Updates a sprint. Lead only. Non-leads get 403, outsiders get 404.
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
  const userId = await getSessionUserId();
  if (userId === null) {
    return unauthenticatedResponse();
  }
  const membership = await findMembershipRole({ userId, teamId });
  if (membership === null) {
    return errorResponse({
      status: 404,
      code: "TEAM_NOT_FOUND",
      message: "This team does not exist.",
    });
  }
  if (membership.role !== "LEAD") {
    return accessDeniedResponse({
      isAllowed: false,
      status: 403,
      code: "FORBIDDEN",
    });
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
    schema: z.record(z.string(), z.unknown()),
  });
  if (!parsedBody.isValid) {
    return parsedBody.response;
  }
  const body = parsedBody.data;
  const sprintInput: SprintInput = {
    id: sprintId,
    name: typeof body.name === "string" ? body.name : existingSprint.name,
    startDate:
      typeof body.startDate === "string"
        ? body.startDate
        : existingSprint.startDate,
    endDate:
      typeof body.endDate === "string" ? body.endDate : existingSprint.endDate,
    standupsPerPerson:
      body.standupsPerPerson === undefined
        ? existingSprint.standupsPerPerson
        : (body.standupsPerPerson as number),
    reviewsPerPerson:
      body.reviewsPerPerson === undefined
        ? existingSprint.reviewsPerPerson
        : (body.reviewsPerPerson as number),
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
