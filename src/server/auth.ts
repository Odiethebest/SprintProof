import {
  checkTeamAccess,
  type TeamAccess,
  type TeamRole,
} from "@/lib/auth/team-access";
import { getSessionUserId } from "@/server/auth-session";
import { findMembershipRole } from "@/server/repositories/memberships";

// Call at the top of every route handler and server page that touches team data
// (AGENTS.md §4). Hiding UI is not access control.
export async function requireTeamRole(
  teamId: string,
  roles: readonly TeamRole[]
): Promise<TeamAccess> {
  const userId = await getSessionUserId();
  const membership =
    userId === null ? null : await findMembershipRole({ userId, teamId });
  return checkTeamAccess({ userId, membership, roles });
}
