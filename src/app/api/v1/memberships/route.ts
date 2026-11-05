import { checkInvite, joinTeamSchema } from "@/lib/invites/invite-link";
import {
  errorResponse,
  parseJsonBody,
  unauthenticatedResponse,
} from "@/server/api-response";
import { getSessionUserId } from "@/server/auth-session";
import { findInviteByToken } from "@/server/repositories/invites";
import { joinTeam } from "@/server/repositories/memberships";

// Joins the team of an invite link: 201 when added, 200 when already a member.
export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (userId === null) {
    return unauthenticatedResponse();
  }
  const parsed = await parseJsonBody({ request, schema: joinTeamSchema });
  if (!parsed.isValid) {
    return parsed.response;
  }
  const invite = await findInviteByToken({ token: parsed.data.inviteToken });
  const check = checkInvite({ invite, now: new Date() });
  if (!check.isValid) {
    return errorResponse(check);
  }
  if (invite === null) {
    // Unreachable: checkInvite rejects a missing link. This narrows the type.
    throw new Error("Invite check passed without an invite");
  }
  const { role, isNew } = await joinTeam({
    userId,
    teamId: invite.teamId,
    role: invite.role,
  });
  return Response.json(
    { teamId: invite.teamId, role },
    { status: isNew ? 201 : 200 }
  );
}
