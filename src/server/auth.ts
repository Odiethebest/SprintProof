import { parseBearerToken } from "@/lib/api-tokens/bearer-token";
import { hashApiToken } from "@/lib/api-tokens/api-token";
import {
  checkTeamAccess,
  type ApiTeamAccess,
  type TeamAccess,
  type TeamRole,
} from "@/lib/auth/team-access";
import {
  getManageableInviteRoles,
  type InviteRole,
} from "@/lib/invites/invite-link";
import { getSessionUserId } from "@/server/auth-session";
import { isCourseStaff } from "@/server/course-staff";
import { recordApiTokenUse } from "@/server/repositories/api-tokens";
import { findMembershipRole } from "@/server/repositories/memberships";
import { findTeam } from "@/server/repositories/teams";

async function checkMembership(
  userId: string | null,
  teamId: string,
  roles: readonly TeamRole[]
): Promise<TeamAccess> {
  const membership =
    userId === null ? null : await findMembershipRole({ userId, teamId });
  return checkTeamAccess({ userId, membership, roles });
}

// Call at the top of every route handler and server page that touches team data
// (AGENTS.md §4). Hiding UI is not access control.
export async function requireTeamRole(
  teamId: string,
  roles: readonly TeamRole[]
): Promise<TeamAccess> {
  return checkMembership(await getSessionUserId(), teamId, roles);
}

export type InviteAccess =
  | { isAllowed: true; userId: string; inviteRoles: InviteRole[] }
  | Extract<TeamAccess, { isAllowed: false }>;

// The invite links the signed-in user may create and revoke on a team
// (decision 006, #116). Course staff manage instructor links even when they
// aren't on the team; anyone who can manage no link gets 403, like a wrong role
// in requireTeamRole(). Session only, so an API token can't create links.
export async function requireInviteAccess(
  teamId: string
): Promise<InviteAccess> {
  const userId = await getSessionUserId();
  if (userId === null) {
    return { isAllowed: false, status: 401, code: "UNAUTHENTICATED" };
  }
  const [membership, isStaff] = await Promise.all([
    findMembershipRole({ userId, teamId }),
    isCourseStaff({ userId }),
  ]);
  const inviteRoles = getManageableInviteRoles({
    teamRole: membership?.role ?? null,
    isCourseStaff: isStaff,
  });
  if (inviteRoles.length === 0) {
    return { isAllowed: false, status: 403, code: "FORBIDDEN" };
  }
  // Course staff off the team: a team that doesn't exist is 403, the same
  // answer everyone gets for it on every other route.
  if (membership === null && (await findTeam({ teamId })) === null) {
    return { isAllowed: false, status: 403, code: "FORBIDDEN" };
  }
  return { isAllowed: true, userId, inviteRoles };
}

// Who is calling, or one of the two 401s: no token and no session
// (UNAUTHENTICATED), or a token that doesn't work (INVALID_TOKEN).
export type ApiUserAccess =
  { isAllowed: true; userId: string } | Extract<ApiTeamAccess, { status: 401 }>;

// The caller of a read-only endpoint that also takes a personal API token (#16,
// #97). A request with an Authorization header is checked by its token alone,
// even when it also carries a session cookie; without one it falls back to the
// session. Every other endpoint uses requireTeamRole(), so a token can't change
// anything.
export async function requireApiUser(request: Request): Promise<ApiUserAccess> {
  const authorization = request.headers.get("authorization");
  if (authorization === null) {
    const userId = await getSessionUserId();
    if (userId === null) {
      return { isAllowed: false, status: 401, code: "UNAUTHENTICATED" };
    }
    return { isAllowed: true, userId };
  }
  const token = parseBearerToken({ authorization });
  const owner =
    token === null
      ? null
      : await recordApiTokenUse({
          tokenHash: hashApiToken({ token }),
          usedAt: new Date(),
        });
  if (owner === null) {
    return { isAllowed: false, status: 401, code: "INVALID_TOKEN" };
  }
  return { isAllowed: true, userId: owner.userId };
}

// requireApiUser(), then the caller's role on the team.
export async function requireApiTeamRole(
  request: Request,
  teamId: string,
  roles: readonly TeamRole[]
): Promise<ApiTeamAccess> {
  const caller = await requireApiUser(request);
  if (!caller.isAllowed) {
    return caller;
  }
  return checkMembership(caller.userId, teamId, roles);
}
