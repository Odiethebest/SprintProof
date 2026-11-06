import { z } from "zod";
import {
  accessDeniedResponse,
  errorResponse,
  parseInput,
} from "@/server/api-response";
import { requireTeamRole } from "@/server/auth";
import { revokeInvite } from "@/server/repositories/invites";

const paramsSchema = z.object({
  teamId: z.string().min(1),
  inviteId: z.string().min(1),
});

// Revokes an invite link. Lead only; revoking twice is a no-op.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ teamId: string; inviteId: string }> }
) {
  const parsedParams = parseInput({
    input: await params,
    schema: paramsSchema,
  });
  if (!parsedParams.isValid) {
    return parsedParams.response;
  }
  const { teamId, inviteId } = parsedParams.data;
  const access = await requireTeamRole(teamId, ["LEAD"]);
  if (!access.isAllowed) {
    return accessDeniedResponse(access);
  }
  const isFound = await revokeInvite({ teamId, inviteId, now: new Date() });
  if (!isFound) {
    return errorResponse({
      status: 404,
      code: "INVITE_NOT_FOUND",
      message: "This team has no invite link with that id.",
    });
  }
  return new Response(null, { status: 204 });
}
