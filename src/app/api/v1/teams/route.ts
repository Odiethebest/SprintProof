import { createTeamSchema } from "@/lib/teams/create-team";
import {
  errorResponse,
  parseJsonBody,
  unauthenticatedResponse,
} from "@/server/api-response";
import { getSessionUserId } from "@/server/auth-session";
import { createTeamWithLead } from "@/server/repositories/teams";

// Creates a team; the signed-in user becomes its LEAD.
export async function POST(request: Request) {
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
