export type TeamRole = "LEAD" | "MEMBER" | "INSTRUCTOR";

export type TeamAccess =
  | { isAllowed: true; userId: string; role: TeamRole }
  | { isAllowed: false; status: 401; code: "UNAUTHENTICATED" }
  | { isAllowed: false; status: 403; code: "FORBIDDEN" };

export interface CheckTeamAccessOptions {
  userId: string | null;
  membership: { role: TeamRole } | null;
  roles: readonly TeamRole[];
}

export function checkTeamAccess({
  userId,
  membership,
  roles,
}: CheckTeamAccessOptions): TeamAccess {
  if (userId === null) {
    return { isAllowed: false, status: 401, code: "UNAUTHENTICATED" };
  }
  // Not on the team is treated like a wrong role: 403 either way (#6).
  if (membership === null || !roles.includes(membership.role)) {
    return { isAllowed: false, status: 403, code: "FORBIDDEN" };
  }
  return { isAllowed: true, userId, role: membership.role };
}
