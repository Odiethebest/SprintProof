import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import {
  listOwnPeerFeedback,
  listPeerFeedbackForInstructor,
  savePeerFeedback,
} from "@/server/repositories/peer-feedback";
import { SPRINT_RETRO_LOCK } from "@/server/write-locks";
import {
  insertMembership,
  insertPeerFeedback,
  insertRetro,
  insertSprint,
  insertTeam,
  insertUser,
} from "../../factories/db";
import { clearDatabase } from "../setup/test-setup";

// A team with a lead, a member and an instructor, and an open Sprint 1 retro
// where each student wrote about the other.
async function teamWithFeedback() {
  const team = await insertTeam();
  const lead = await insertUser({ name: "Ziqi (Odie) Yang" });
  const member = await insertUser({ name: "Yunhong Huang" });
  const instructor = await insertUser({ name: "Course TA" });
  await insertMembership({ userId: lead.id, teamId: team.id, role: "LEAD" });
  await insertMembership({
    userId: member.id,
    teamId: team.id,
    role: "MEMBER",
  });
  await insertMembership({
    userId: instructor.id,
    teamId: team.id,
    role: "INSTRUCTOR",
  });
  const sprint = await insertSprint({ teamId: team.id, name: "Sprint 1" });
  await insertRetro({ sprintId: sprint.id });
  const aboutLead = await insertPeerFeedback({
    sprintId: sprint.id,
    authorId: member.id,
    recipientId: lead.id,
    text: "About the lead.",
    createdAt: new Date("2026-11-03T17:00:00Z"),
  });
  const aboutMember = await insertPeerFeedback({
    sprintId: sprint.id,
    authorId: lead.id,
    recipientId: member.id,
    text: "About the member.",
    createdAt: new Date("2026-11-04T17:00:00Z"),
  });
  return { team, lead, member, instructor, sprint, aboutLead, aboutMember };
}

describe("peer feedback repository", () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  describe("listPeerFeedbackForInstructor", () => {
    it("lists a sprint's feedback for an instructor of the team, oldest first", async () => {
      // Arrange
      const { team, instructor, sprint, aboutLead, aboutMember } =
        await teamWithFeedback();

      // Act
      const entries = await listPeerFeedbackForInstructor({
        teamId: team.id,
        sprintId: sprint.id,
        instructorId: instructor.id,
      });

      // Assert
      expect(entries?.map((entry) => entry.id)).toEqual([
        aboutLead.id,
        aboutMember.id,
      ]);
      expect(entries?.[0]).toMatchObject({
        sprintId: sprint.id,
        author: { name: "Yunhong Huang" },
        recipient: { name: "Ziqi (Odie) Yang" },
        text: "About the lead.",
      });
    });

    it.each(["lead", "member"] as const)(
      "gives the team's %s nothing, not even an empty list (rule R7)",
      async (role) => {
        // Arrange
        const { team, sprint, ...users } = await teamWithFeedback();

        // Act
        const entries = await listPeerFeedbackForInstructor({
          teamId: team.id,
          sprintId: sprint.id,
          instructorId: users[role].id,
        });

        // Assert
        expect(entries).toBeNull();
      }
    );

    it("gives an instructor of another team nothing", async () => {
      // Arrange
      const { team, sprint } = await teamWithFeedback();
      const otherTeam = await insertTeam();
      const otherInstructor = await insertUser();
      await insertMembership({
        userId: otherInstructor.id,
        teamId: otherTeam.id,
        role: "INSTRUCTOR",
      });

      // Act
      const entries = await listPeerFeedbackForInstructor({
        teamId: team.id,
        sprintId: sprint.id,
        instructorId: otherInstructor.id,
      });

      // Assert
      expect(entries).toBeNull();
    });

    it("lists none of another team's feedback, even for a sprint id from that team", async () => {
      // Arrange: the instructor is on `team`; `sprint` belongs to another team
      const { sprint } = await teamWithFeedback();
      const team = await insertTeam();
      const instructor = await insertUser();
      await insertMembership({
        userId: instructor.id,
        teamId: team.id,
        role: "INSTRUCTOR",
      });

      // Act
      const entries = await listPeerFeedbackForInstructor({
        teamId: team.id,
        sprintId: sprint.id,
        instructorId: instructor.id,
      });

      // Assert
      expect(entries).toEqual([]);
    });

    it("treats ids with a NUL character as unknown", async () => {
      // Arrange
      const { team, instructor } = await teamWithFeedback();

      // Act
      const entries = await listPeerFeedbackForInstructor({
        teamId: team.id,
        sprintId: "bad\u0000id",
        instructorId: instructor.id,
      });

      // Assert
      expect(entries).toEqual([]);
    });
  });

  describe("listOwnPeerFeedback", () => {
    it("lists only what the author wrote, never what a teammate wrote about them", async () => {
      // Arrange
      const { member, sprint, aboutLead } = await teamWithFeedback();

      // Act
      const entries = await listOwnPeerFeedback({
        sprintId: sprint.id,
        authorId: member.id,
      });

      // Assert
      expect(entries.map((entry) => entry.id)).toEqual([aboutLead.id]);
      expect(entries.map((entry) => entry.text)).not.toContain(
        "About the member."
      );
    });

    it("lists only the given sprint's entries", async () => {
      // Arrange
      const { team, member } = await teamWithFeedback();
      const sprint2 = await insertSprint({
        teamId: team.id,
        startDate: "2026-11-05",
        endDate: "2026-11-11",
      });

      // Act
      const entries = await listOwnPeerFeedback({
        sprintId: sprint2.id,
        authorId: member.id,
      });

      // Assert
      expect(entries).toEqual([]);
    });
  });

  describe("savePeerFeedback", () => {
    it("waits for a retro that's closing, then refuses the change", async () => {
      // Arrange: another transaction holds the retro's lock while it closes it
      const { team, lead, member, sprint } = await teamWithFeedback();
      let save: Promise<unknown> | null = null;
      let hasSavedWhileClosing = false;

      // Act
      await db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${SPRINT_RETRO_LOCK}::integer, hashtext(${sprint.id}))`;
        await tx.retro.update({
          where: { sprintId: sprint.id },
          data: { closedAt: new Date() },
        });
        save = savePeerFeedback({
          teamId: team.id,
          sprintId: sprint.id,
          authorId: member.id,
          recipientId: lead.id,
          text: "Changed while the retro closed.",
        });
        void save.then(() => (hasSavedWhileClosing = true));
        await new Promise((resolve) => setTimeout(resolve, 300));
      });

      // Assert
      expect(hasSavedWhileClosing).toBe(false);
      expect(await save).toEqual({ status: "RETRO_CLOSED" });
      const stored = await db.peerFeedback.findFirstOrThrow({
        where: { authorId: member.id },
      });
      expect(stored.text).toBe("About the lead.");
    });
  });
});
