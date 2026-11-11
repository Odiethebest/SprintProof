import { createTeamSchema } from "@/lib/teams/create-team";
import {
  accessDeniedResponse,
  catchUnexpectedErrors,
  errorResponse,
  invalidCursorResponse,
  parseJsonBody,
  parsePaginationQuery,
  unauthenticatedResponse,
} from "@/server/api-response";
import { requireApiUser } from "@/server/auth";
import { getSessionUserId } from "@/server/auth-session";
import {
  createTeamWithLead,
  listTeamsPageForUser,
} from "@/server/repositories/teams";

// GET: The caller's teams with their role on each, in the order they joined,
// one page at a time. Takes a session or an API token (#97).
export async function GET(request: Request) {
  return catchUnexpectedErrors({
    route: "GET /api/v1/teams",
    handler: () => handleGet(request),
  });
}

// POST: Creates a team; the signed-in user becomes its LEAD.
export async function POST(request: Request) {
  return catchUnexpectedErrors({
    route: "POST /api/v1/teams",
    handler: () => handlePost(request),
  });
}

async function handleGet(request: Request) {
  const caller = await requireApiUser(request);
  if (!caller.isAllowed) {
    return accessDeniedResponse(caller);
  }
  const query = parsePaginationQuery({ request });
  if (!query.isValid) {
    return query.response;
  }
  const page = await listTeamsPageForUser({
    userId: caller.userId,
    ...query.data,
  });
  if (page === null) {
    return invalidCursorResponse();
  }
  return Response.json(page);
}

async function handlePost(request: Request) {
  const userId = await getSessionUserId();
  if (userId === null) {
    return unauthenticatedResponse();
  }
  const parsed = await parseJsonBody({ request, schema: createTeamSchema });
  if (!parsed.isValid) {
    return parsed.response;
  }
  const team = await createTeamWithLead({
    input: parsed.data,
    leadUserId: userId,
  });
  if (team === null) {
    return errorResponse({
      status: 409,
      code: "REPO_ALREADY_CONNECTED",
      message: "Another team already connected this repo.",
    });
  }
  return Response.json(team, { status: 201 });
}
