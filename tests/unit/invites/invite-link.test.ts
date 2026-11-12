import { describe, expect, it } from "vitest";
import {
  INVITE_TTL_DAYS,
  checkInvite,
  getInviteExpiry,
  getManageableInviteRoles,
} from "@/lib/invites/invite-link";
import { createInviteLink } from "../../factories";

describe("getInviteExpiry", () => {
  it("expires a link 7 days after it was created", () => {
    // Act
    const expiresAt = getInviteExpiry({
      createdAt: new Date("2026-11-05T18:00:00.000Z"),
    });

    // Assert
    expect(INVITE_TTL_DAYS).toBe(7);
    expect(expiresAt).toEqual(new Date("2026-11-12T18:00:00.000Z"));
  });

  it("counts exactly 7 × 24 hours across the end of daylight saving time", () => {
    // Arrange: US clocks fall back on Nov 1, 2026.
    const createdAt = new Date("2026-10-29T16:00:00.000Z");

    // Act
    const expiresAt = getInviteExpiry({ createdAt });

    // Assert
    expect(expiresAt.getTime() - createdAt.getTime()).toBe(
      7 * 24 * 60 * 60 * 1000
    );
  });
});

describe("checkInvite", () => {
  it("accepts a link before it expires", () => {
    // Arrange
    const invite = createInviteLink({
      expiresAt: new Date("2026-11-12T18:00:00.000Z"),
    });

    // Act
    const check = checkInvite({
      invite,
      now: new Date("2026-11-12T17:59:59.999Z"),
    });

    // Assert
    expect(check).toEqual({ isValid: true });
  });

  it("rejects an unknown link with 404", () => {
    expect(
      checkInvite({ invite: null, now: new Date("2026-11-05T18:00:00.000Z") })
    ).toEqual({
      isValid: false,
      status: 404,
      code: "INVITE_NOT_FOUND",
      message:
        "This invite link doesn't work. Check that you copied the whole link, or ask your team lead for a new one.",
    });
  });

  it("rejects a link at the moment it expires with 410", () => {
    // Arrange
    const invite = createInviteLink({
      expiresAt: new Date("2026-11-12T18:00:00.000Z"),
    });

    // Act
    const check = checkInvite({
      invite,
      now: new Date("2026-11-12T18:00:00.000Z"),
    });

    // Assert
    expect(check).toEqual({
      isValid: false,
      status: 410,
      code: "INVITE_EXPIRED",
      message:
        "This invite link has expired. Ask your team lead for a new one.",
    });
  });

  it("rejects a revoked link with 410", () => {
    // Arrange
    const invite = createInviteLink({
      expiresAt: new Date("2026-11-12T18:00:00.000Z"),
      revokedAt: new Date("2026-11-06T09:00:00.000Z"),
    });

    // Act
    const check = checkInvite({
      invite,
      now: new Date("2026-11-07T09:00:00.000Z"),
    });

    // Assert
    expect(check).toEqual({
      isValid: false,
      status: 410,
      code: "INVITE_REVOKED",
      message:
        "This invite link was revoked. Ask your team lead for a new one.",
    });
  });

  it.each([
    [
      "expired",
      { revokedAt: null },
      "This invite link has expired. Ask course staff for a new one.",
    ],
    [
      "was revoked",
      { revokedAt: new Date("2026-11-06T09:00:00.000Z") },
      "This invite link was revoked. Ask course staff for a new one.",
    ],
  ])(
    "sends someone whose instructor link %s to course staff, not the lead",
    (_label, overrides, message) => {
      // Arrange: decision 006, #116: the lead can't create instructor links.
      const invite = createInviteLink({
        role: "INSTRUCTOR",
        expiresAt: new Date("2026-11-12T18:00:00.000Z"),
        ...overrides,
      });

      // Act
      const check = checkInvite({
        invite,
        now: new Date("2026-11-20T09:00:00.000Z"),
      });

      // Assert
      expect(check).toMatchObject({ isValid: false, status: 410, message });
    }
  );

  it("reports a link that was revoked and has since expired as revoked", () => {
    // Arrange
    const invite = createInviteLink({
      expiresAt: new Date("2026-11-12T18:00:00.000Z"),
      revokedAt: new Date("2026-11-06T09:00:00.000Z"),
    });

    // Act
    const check = checkInvite({
      invite,
      now: new Date("2026-11-20T09:00:00.000Z"),
    });

    // Assert
    expect(check).toMatchObject({ isValid: false, code: "INVITE_REVOKED" });
  });
});

describe("getManageableInviteRoles", () => {
  it("lets the lead manage member links only", () => {
    // Act
    const roles = getManageableInviteRoles({
      teamRole: "LEAD",
      isCourseStaff: false,
    });

    // Assert
    expect(roles).toEqual(["MEMBER"]);
  });

  it("lets the team's instructors manage instructor links only", () => {
    // Act
    const roles = getManageableInviteRoles({
      teamRole: "INSTRUCTOR",
      isCourseStaff: false,
    });

    // Assert
    expect(roles).toEqual(["INSTRUCTOR"]);
  });

  it("lets a member manage no links", () => {
    // Act
    const roles = getManageableInviteRoles({
      teamRole: "MEMBER",
      isCourseStaff: false,
    });

    // Assert
    expect(roles).toEqual([]);
  });

  it("lets course staff who aren't on the team manage instructor links", () => {
    // Act
    const roles = getManageableInviteRoles({
      teamRole: null,
      isCourseStaff: true,
    });

    // Assert
    expect(roles).toEqual(["INSTRUCTOR"]);
  });

  it("lets nobody else outside the team manage links", () => {
    // Act
    const roles = getManageableInviteRoles({
      teamRole: null,
      isCourseStaff: false,
    });

    // Assert
    expect(roles).toEqual([]);
  });

  it("lets course staff on the team as a member manage instructor links", () => {
    // Act
    const roles = getManageableInviteRoles({
      teamRole: "MEMBER",
      isCourseStaff: true,
    });

    // Assert
    expect(roles).toEqual(["INSTRUCTOR"]);
  });

  it("lets a lead who is course staff manage both links, member first", () => {
    // Act
    const roles = getManageableInviteRoles({
      teamRole: "LEAD",
      isCourseStaff: true,
    });

    // Assert
    expect(roles).toEqual(["MEMBER", "INSTRUCTOR"]);
  });
});
