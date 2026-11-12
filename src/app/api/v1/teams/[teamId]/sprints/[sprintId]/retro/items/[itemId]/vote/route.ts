import { z } from "zod";
import {
  accessDeniedResponse,
  catchUnexpectedErrors,
  parseInput,
  sprintNotFoundResponse,
} from "@/server/api-response";
import { requireTeamRole } from "@/server/auth";
import { triggerTeamEvent } from "@/server/realtime";
import { setRetroVote } from "@/server/repositories/retros";
import { findSprintById } from "@/server/repositories/sprints";
import { retroErrorResponse } from "@/server/retro-response";

const paramsSchema = z.object({
  teamId: z.string().min(1),
  sprintId: z.string().min(1),
  itemId: z.string().min(1),
});

interface Context {
  params: Promise<{ teamId: string; sprintId: string; itemId: string }>;
}

// PUT: Votes for the item. Voting twice keeps one vote; a 4th vote in the
// retro is refused (rule R6). Leads and members only.
export async function PUT(_request: Request, context: Context) {
  return catchUnexpectedErrors({
    route:
      "PUT /api/v1/teams/{teamId}/sprints/{sprintId}/retro/items/{itemId}/vote",
    handler: () => handleVote(context, true),
  });
}

// DELETE: Takes the caller's vote on the item back, so it can go elsewhere.
export async function DELETE(_request: Request, context: Context) {
  return catchUnexpectedErrors({
    route:
      "DELETE /api/v1/teams/{teamId}/sprints/{sprintId}/retro/items/{itemId}/vote",
    handler: () => handleVote(context, false),
  });
}

async function handleVote({ params }: Context, isVoting: boolean) {
  const parsedParams = parseInput({
    input: await params,
    schema: paramsSchema,
  });
  if (!parsedParams.isValid) {
    return parsedParams.response;
  }
  const { teamId, sprintId, itemId } = parsedParams.data;
  const access = await requireTeamRole(teamId, ["LEAD", "MEMBER"]);
  if (!access.isAllowed) {
    return accessDeniedResponse(access);
  }
  if ((await findSprintById({ teamId, sprintId })) === null) {
    return sprintNotFoundResponse();
  }
  const result = await setRetroVote({
    sprintId,
    itemId,
    userId: access.userId,
    isVoting,
  });
  if (result.status !== "SAVED") {
    return retroErrorResponse(result.status);
  }
  await triggerTeamEvent({ teamId, event: "retro.updated" });
  return Response.json({
    itemId,
    voteCount: result.voteCount,
    hasVoted: result.hasVoted,
    votesLeft: result.votesLeft,
  });
}
