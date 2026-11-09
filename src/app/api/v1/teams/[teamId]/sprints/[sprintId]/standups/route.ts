import { z } from "zod";
import {
  accessDeniedResponse,
  invalidCursorResponse,
  parseInput,
  parsePaginationQuery,
  sprintNotFoundResponse,
} from "@/server/api-response";
import { requireApiTeamRole } from "@/server/auth";
import { findSprintById } from "@/server/repositories/sprints";
import { listSprintStandupsPage } from "@/server/repositories/standups";

const paramsSchema = z.object({
  teamId: z.string().min(1),
  sprintId: z.string().min(1),
});

// GET: A sprint's standups, newest first, one page at a time. Any member can
// read them, with a session or an API token (#16).
export async function GET(
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

  const sprint = await findSprintById({ teamId, sprintId });
  if (sprint === null) {
    return sprintNotFoundResponse();
  }
  const page = await listSprintStandupsPage({ sprint, ...query.data });
  if (page === null) {
    return invalidCursorResponse();
  }
  return Response.json(page);
}
