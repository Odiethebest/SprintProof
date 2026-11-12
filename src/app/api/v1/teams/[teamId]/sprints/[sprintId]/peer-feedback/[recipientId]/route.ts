import { z } from "zod";
import { savePeerFeedbackSchema } from "@/lib/peer-feedback/peer-feedback-input";
import {
  accessDeniedResponse,
  catchUnexpectedErrors,
  parseInput,
  parseJsonBody,
  sprintNotFoundResponse,
} from "@/server/api-response";
import { requireTeamRole } from "@/server/auth";
import {
  peerFeedbackErrorResponse,
  toPeerFeedbackResponse,
} from "@/server/peer-feedback-response";
import { savePeerFeedback } from "@/server/repositories/peer-feedback";
import { findSprintById } from "@/server/repositories/sprints";

const paramsSchema = z.object({
  teamId: z.string().min(1),
  sprintId: z.string().min(1),
  recipientId: z.string().min(1),
});

interface Context {
  params: Promise<{ teamId: string; sprintId: string; recipientId: string }>;
}

// PUT: Saves the caller's partner feedback about one teammate for the sprint,
// replacing what they saved before, while the sprint's retro is open (#14).
// Leads and members only. The response is the caller's own entry; no one on
// the team ever reads someone else's (rule R7).
export async function PUT(request: Request, context: Context) {
  return catchUnexpectedErrors({
    route:
      "PUT /api/v1/teams/{teamId}/sprints/{sprintId}/peer-feedback/{recipientId}",
    handler: () => handlePut(request, context),
  });
}

async function handlePut(request: Request, { params }: Context) {
  const parsedParams = parseInput({
    input: await params,
    schema: paramsSchema,
  });
  if (!parsedParams.isValid) {
    return parsedParams.response;
  }
  const { teamId, sprintId, recipientId } = parsedParams.data;
  const access = await requireTeamRole(teamId, ["LEAD", "MEMBER"]);
  if (!access.isAllowed) {
    return accessDeniedResponse(access);
  }
  if ((await findSprintById({ teamId, sprintId })) === null) {
    return sprintNotFoundResponse();
  }
  const parsedBody = await parseJsonBody({
    request,
    schema: savePeerFeedbackSchema,
  });
  if (!parsedBody.isValid) {
    return parsedBody.response;
  }
  const result = await savePeerFeedback({
    teamId,
    sprintId,
    authorId: access.userId,
    recipientId,
    text: parsedBody.data.text,
  });
  if (result.status !== "SAVED") {
    return peerFeedbackErrorResponse(result.status);
  }
  // No team event: no teammate's page shows anything about feedback, so
  // there's nothing for them to refetch, or to learn from the event itself.
  return Response.json(toPeerFeedbackResponse(result.feedback));
}
