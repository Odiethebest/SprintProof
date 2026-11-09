import { parseBearerToken } from "@/lib/api-tokens/bearer-token";
import { hashApiToken } from "@/lib/api-tokens/api-token";
import {
  checkTeamAccess,
  type ApiTeamAccess,
  type TeamAccess,
  type TeamRole,
} from "@/lib/auth/team-access";
import { getSessionUserId } from "@/server/auth-session";
import { recordApiTokenUse } from "@/server/repositories/api-tokens";
import { findMembershipRole } from "@/server/repositories/memberships";

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

// For the read-only endpoints that also take a personal API token (#16). A
// request with an Authorization header is checked by its token alone, even when
// it also carries a session cookie; without one it falls back to the session.
// Every other endpoint uses requireTeamRole(), so a token can't change anything.
export async function requireApiTeamRole(
  request: Request,
  teamId: string,
  roles: readonly TeamRole[]
): Promise<ApiTeamAccess> {
  const authorization = request.headers.get("authorization");
  if (authorization === null) {
    return requireTeamRole(teamId, roles);
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
  return checkMembership(owner.userId, teamId, roles);
}
