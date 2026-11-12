import { z } from "zod";
import {
  accessDeniedResponse,
  catchUnexpectedErrors,
  errorResponse,
  inviteRoleForbiddenResponse,
  parseInput,
} from "@/server/api-response";
import { requireInviteAccess } from "@/server/auth";
import { findTeamInvite, revokeInvite } from "@/server/repositories/invites";

const paramsSchema = z.object({
  teamId: z.string().min(1),
  inviteId: z.string().min(1),
});

interface Context {
  params: Promise<{ teamId: string; inviteId: string }>;
}

// Revokes an invite link; revoking twice is a no-op. Whoever can create links
// for its role can revoke it (decision 006, #116).
export async function DELETE(_request: Request, context: Context) {
  return catchUnexpectedErrors({
    route: "DELETE /api/v1/teams/{teamId}/invites/{inviteId}",
    handler: () => handleDelete(context),
  });
}

function inviteNotFoundResponse(): Response {
  return errorResponse({
    status: 404,
    code: "INVITE_NOT_FOUND",
    message: "This team has no invite link with that id.",
  });
}

async function handleDelete({ params }: Context) {
  const parsedParams = parseInput({
    input: await params,
    schema: paramsSchema,
  });
  if (!parsedParams.isValid) {
    return parsedParams.response;
  }
  const { teamId, inviteId } = parsedParams.data;
  const access = await requireInviteAccess(teamId);
  if (!access.isAllowed) {
    return accessDeniedResponse(access);
  }
  const invite = await findTeamInvite({ teamId, inviteId });
  if (invite === null) {
    return inviteNotFoundResponse();
  }
  if (!access.inviteRoles.some((role) => role === invite.role)) {
    return inviteRoleForbiddenResponse({ role: invite.role });
  }
  const isFound = await revokeInvite({ teamId, inviteId, now: new Date() });
  if (!isFound) {
    return inviteNotFoundResponse();
  }
  return new Response(null, { status: 204 });
}
