import { noNul } from "@/lib/validation/text";
import { z } from "zod";
import type { TeamRole } from "@/lib/auth/team-access";

export const INVITE_TTL_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

// A link can't make someone LEAD: the lead is whoever created the team.
export const INVITE_ROLES = [
  "MEMBER",
  "INSTRUCTOR",
] as const satisfies readonly TeamRole[];
export type InviteRole = (typeof INVITE_ROLES)[number];

export interface InviteLink {
  role: TeamRole;
  expiresAt: Date;
  revokedAt: Date | null;
}

export type InviteCheck =
  | { isValid: true }
  | {
      isValid: false;
      status: 404;
      code: "INVITE_NOT_FOUND";
      message: string;
    }
  | {
      isValid: false;
      status: 410;
      code: "INVITE_EXPIRED" | "INVITE_REVOKED";
      message: string;
    };

export const createInviteSchema = z.object({
  role: z.enum(INVITE_ROLES, { error: "Choose MEMBER or INSTRUCTOR." }),
});

export const joinTeamSchema = z.object({
  inviteToken: z
    .string({ error: "Add the invite token." })
    .min(1, "Add the invite token.")
    .check(noNul),
});

// Who can create and revoke each kind of link (decision 006, #116): the lead
// manages member links; course staff and the team's instructors manage
// instructor links, and course staff don't have to be on the team. Keeping
// instructor links from the lead stops them joining their own team as an
// instructor with a second account and reading peer feedback (PRD R7).
export function getManageableInviteRoles({
  teamRole,
  isCourseStaff,
}: {
  // null when the user isn't on the team.
  teamRole: TeamRole | null;
  isCourseStaff: boolean;
}): InviteRole[] {
  const canManage: Record<InviteRole, boolean> = {
    MEMBER: teamRole === "LEAD",
    INSTRUCTOR: isCourseStaff || teamRole === "INSTRUCTOR",
  };
  return INVITE_ROLES.filter((role) => canManage[role]);
}

// Who to ask for a new link: the lead can't create instructor links.
const ASK_FOR_A_NEW_LINK: Record<TeamRole, string> = {
  LEAD: "Ask your team lead for a new one.",
  MEMBER: "Ask your team lead for a new one.",
  INSTRUCTOR: "Ask course staff for a new one.",
};

// An exact 7 × 24 hours, so daylight saving changes never shorten a link.
export function getInviteExpiry({ createdAt }: { createdAt: Date }): Date {
  return new Date(createdAt.getTime() + INVITE_TTL_DAYS * DAY_MS);
}

export function checkInvite({
  invite,
  now,
}: {
  invite: InviteLink | null;
  now: Date;
}): InviteCheck {
  if (invite === null) {
    return {
      isValid: false,
      status: 404,
      code: "INVITE_NOT_FOUND",
      message:
        "This invite link doesn't work. Check that you copied the whole link, or ask your team lead for a new one.",
    };
  }
  // Revoked wins over expired: the lead turned it off on purpose.
  if (invite.revokedAt !== null) {
    return {
      isValid: false,
      status: 410,
      code: "INVITE_REVOKED",
      message: `This invite link was revoked. ${ASK_FOR_A_NEW_LINK[invite.role]}`,
    };
  }
  if (now.getTime() >= invite.expiresAt.getTime()) {
    return {
      isValid: false,
      status: 410,
      code: "INVITE_EXPIRED",
      message: `This invite link has expired. ${ASK_FOR_A_NEW_LINK[invite.role]}`,
    };
  }
  return { isValid: true };
}
