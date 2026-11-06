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
    .min(1, "Add the invite token."),
});

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
      message:
        "This invite link was revoked. Ask your team lead for a new one.",
    };
  }
  if (now.getTime() >= invite.expiresAt.getTime()) {
    return {
      isValid: false,
      status: 410,
      code: "INVITE_EXPIRED",
      message:
        "This invite link has expired. Ask your team lead for a new one.",
    };
  }
  return { isValid: true };
}
