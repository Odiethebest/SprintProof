import type { InviteLink } from "@/lib/invites/invite-link";

export function createInviteLink(
  overrides: Partial<InviteLink> = {}
): InviteLink {
  return {
    expiresAt: new Date("2026-11-12T18:00:00.000Z"),
    revokedAt: null,
    ...overrides,
  };
}
