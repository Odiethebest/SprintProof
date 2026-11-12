import { z } from "zod";
import {
  accessDeniedResponse,
  catchUnexpectedErrors,
  invalidCursorResponse,
  parseInput,
  parsePaginationQuery,
  sprintNotFoundResponse,
} from "@/server/api-response";
import { requireTeamRole } from "@/server/auth";
import {
  peerFeedbackErrorResponse,
  toPeerFeedbackResponse,
} from "@/server/peer-feedback-response";
import { listPeerFeedbackPageForInstructor } from "@/server/repositories/peer-feedback";
import { findSprintById } from "@/server/repositories/sprints";

const paramsSchema = z.object({
  teamId: z.string().min(1),
  sprintId: z.string().min(1),
});

interface Context {
  params: Promise<{ teamId: string; sprintId: string }>;
}

// GET: A sprint's partner feedback, oldest first, one page at a time (#14).
// The team's instructors only, with a session (rule R7).
export async function GET(request: Request, context: Context) {
  return catchUnexpectedErrors({
    route: "GET /api/v1/teams/{teamId}/sprints/{sprintId}/peer-feedback",
    handler: () => handleGet(request, context),
  });
}

async function handleGet(request: Request, { params }: Context) {
  const parsedParams = parseInput({
    input: await params,
    schema: paramsSchema,
  });
  if (!parsedParams.isValid) {
    return parsedParams.response;
  }
  const { teamId, sprintId } = parsedParams.data;
  const access = await requireTeamRole(teamId, ["INSTRUCTOR"]);
  if (!access.isAllowed) {
    if (access.status === 401) {
      return accessDeniedResponse(access);
    }
    // Rule R7: a lead, a member or anyone off the team gets the answer a
    // sprint without feedback would give, so they don't even learn it exists.
    return peerFeedbackErrorResponse("PEER_FEEDBACK_NOT_FOUND");
  }
  const query = parsePaginationQuery({ request });
  if (!query.isValid) {
    return query.response;
  }
  if ((await findSprintById({ teamId, sprintId })) === null) {
    return sprintNotFoundResponse();
  }
  const result = await listPeerFeedbackPageForInstructor({
    teamId,
    sprintId,
    instructorId: access.userId,
    ...query.data,
  });
  if (result.status === "NOT_INSTRUCTOR") {
    return peerFeedbackErrorResponse("PEER_FEEDBACK_NOT_FOUND");
  }
  if (result.status === "INVALID_CURSOR") {
    return invalidCursorResponse();
  }
  return Response.json({
    data: result.page.data.map(toPeerFeedbackResponse),
    nextCursor: result.page.nextCursor,
  });
}
