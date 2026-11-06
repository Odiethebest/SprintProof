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
import { createSprint, listSprints } from "@/server/repositories/sprints";

const paramsSchema = z.object({ teamId: z.string().min(1) });

// GET: Lists a team's sprints. Accessible to all team members (LEAD, MEMBER, INSTRUCTOR).
// Outsiders get 404.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const parsedParams = parseInput({
    input: await params,
    schema: paramsSchema,
  });
  if (!parsedParams.isValid) {
    return parsedParams.response;
  }
  const { teamId } = parsedParams.data;
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
  const sprints = await listSprints({ teamId });
  return Response.json({ data: sprints });
}

// POST: Creates a sprint. Lead only. Non-leads get 403, outsiders get 404.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const parsedParams = parseInput({
    input: await params,
    schema: paramsSchema,
  });
  if (!parsedParams.isValid) {
    return parsedParams.response;
  }
  const { teamId } = parsedParams.data;
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
  const parsedBody = await parseJsonBody({
    request,
    schema: z.record(z.string(), z.unknown()),
  });
  if (!parsedBody.isValid) {
    return parsedBody.response;
  }
  const body = parsedBody.data;
  const sprintInput: SprintInput = {
    name: typeof body.name === "string" ? body.name : "",
    startDate: typeof body.startDate === "string" ? body.startDate : "",
    endDate: typeof body.endDate === "string" ? body.endDate : "",
    standupsPerPerson:
      body.standupsPerPerson === undefined
        ? 3
        : (body.standupsPerPerson as number),
    reviewsPerPerson:
      body.reviewsPerPerson === undefined
        ? 5
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

  const created = await createSprint({ teamId, ...sprintInput });
  return Response.json(created, { status: 201 });
}
