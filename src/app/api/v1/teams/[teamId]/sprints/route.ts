import { z } from "zod";
import { createSprintSchema, validateSprint } from "@/lib/sprints";
import {
  accessDeniedResponse,
  errorResponse,
  invalidCursorResponse,
  parseInput,
  parseJsonBody,
  parsePaginationQuery,
} from "@/server/api-response";
import { requireApiTeamRole, requireTeamRole } from "@/server/auth";
import {
  createSprint,
  listSprints,
  listSprintsPage,
} from "@/server/repositories/sprints";

const paramsSchema = z.object({ teamId: z.string().min(1) });

// GET: Lists a team's sprints, oldest first, one page at a time. Any member
// (LEAD, MEMBER, INSTRUCTOR) can list, with a session or an API token (#16).
export async function GET(
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
  const access = await requireApiTeamRole(request, teamId, [
    "LEAD",
    "MEMBER",
    "INSTRUCTOR",
  ]);
  if (!access.isAllowed) {
    return accessDeniedResponse(access);
  }
  const query = parsePaginationQuery({ request });
  if (!query.isValid) {
    return query.response;
  }
  const page = await listSprintsPage({ teamId, ...query.data });
  if (page === null) {
    return invalidCursorResponse();
  }
  return Response.json(page);
}

// POST: Creates a sprint. Lead only.
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
  const access = await requireTeamRole(teamId, ["LEAD"]);
  if (!access.isAllowed) {
    return accessDeniedResponse(access);
  }
  const parsedBody = await parseJsonBody({
    request,
    schema: createSprintSchema,
  });
  if (!parsedBody.isValid) {
    return parsedBody.response;
  }
  const sprintInput = parsedBody.data;

  const existingSprints = await listSprints({ teamId });
  const errors = validateSprint({ sprint: sprintInput, existingSprints });
  if (errors.length > 0) {
    return errorResponse({
      status: 400,
      code: "VALIDATION_ERROR",
      message: errors[0].message,
    });
  }

  const created = await createSprint({ ...sprintInput, teamId });
  return Response.json(created, { status: 201 });
}
