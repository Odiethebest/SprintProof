import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  MAX_STANDUP_FIELD_LENGTH,
  createStandupSchema,
} from "@/lib/standups/standup-input";

function fieldErrors(input: unknown) {
  const result = createStandupSchema.safeParse(input);
  if (result.success) {
    throw new Error("Expected the input to be rejected");
  }
  return z.flattenError(result.error).fieldErrors;
}

const validInput = {
  yesterday: "GitHub sign-in works on preview deploys (#6).",
  today: "Team creation and invite links (#7).",
  blockers: "Waiting on reviews for #107 and #108.",
};

const YESTERDAY_REQUIRED = "Add what you worked on yesterday.";
const TODAY_REQUIRED = "Add what you plan to work on today.";
const TOO_LONG = "Use 1000 characters or fewer.";

describe("createStandupSchema", () => {
  it("accepts yesterday, today and blockers", () => {
    expect(createStandupSchema.parse(validInput)).toEqual(validInput);
  });

  it("allows 1000 characters per field", () => {
    expect(MAX_STANDUP_FIELD_LENGTH).toBe(1000);
  });

  it("trims spaces and line breaks around each field", () => {
    // Act
    const standup = createStandupSchema.parse({
      yesterday: "  Wrote the PRD.\n",
      today: "\n  Open the PR.  ",
      blockers: "  None yet.  ",
    });

    // Assert
    expect(standup).toEqual({
      yesterday: "Wrote the PRD.",
      today: "Open the PR.",
      blockers: "None yet.",
    });
  });

  it("keeps line breaks inside a field", () => {
    const yesterday = "Wrote the PRD.\nOpened the PR.";
    expect(
      createStandupSchema.parse({ ...validInput, yesterday }).yesterday
    ).toBe(yesterday);
  });

  // The server picks the sprint and the date (rule R2), so a client can't file a standup elsewhere.
  it("drops a sprintId, date or userId sent by the client", () => {
    // Act
    const standup = createStandupSchema.parse({
      ...validInput,
      sprintId: "sprint-2",
      date: "2026-10-01",
      userId: "someone-else",
    });

    // Assert
    expect(standup).toEqual(validInput);
  });

  describe("yesterday", () => {
    it.each([
      ["missing", undefined],
      ["empty", ""],
      ["only spaces", "   "],
      ["only line breaks", "\n\n"],
      ["not text", 42],
      ["null", null],
    ])("asks what you worked on when it is %s", (_label, yesterday) => {
      expect(fieldErrors({ ...validInput, yesterday }).yesterday).toEqual([
        YESTERDAY_REQUIRED,
      ]);
    });

    it("accepts 1000 characters", () => {
      const yesterday = "a".repeat(1000);
      expect(
        createStandupSchema.parse({ ...validInput, yesterday }).yesterday
      ).toBe(yesterday);
    });

    it("rejects 1001 characters", () => {
      expect(
        fieldErrors({ ...validInput, yesterday: "a".repeat(1001) }).yesterday
      ).toEqual([TOO_LONG]);
    });

    it("counts characters after trimming", () => {
      const yesterday = "a".repeat(1000);
      expect(
        createStandupSchema.parse({
          ...validInput,
          yesterday: ` ${yesterday} `,
        }).yesterday
      ).toBe(yesterday);
    });
  });

  describe("today", () => {
    it.each([
      ["missing", undefined],
      ["empty", ""],
      ["only spaces", "   "],
      ["only line breaks", "\n\n"],
      ["not text", 42],
      ["null", null],
    ])("asks what you plan to work on when it is %s", (_label, today) => {
      expect(fieldErrors({ ...validInput, today }).today).toEqual([
        TODAY_REQUIRED,
      ]);
    });

    it("accepts 1000 characters", () => {
      const today = "a".repeat(1000);
      expect(createStandupSchema.parse({ ...validInput, today }).today).toBe(
        today
      );
    });

    it("rejects 1001 characters", () => {
      expect(
        fieldErrors({ ...validInput, today: "a".repeat(1001) }).today
      ).toEqual([TOO_LONG]);
    });
  });

  describe("blockers", () => {
    it.each([
      ["missing", undefined],
      ["null", null],
      ["empty", ""],
      ["only spaces", "   "],
    ])("is stored as null when it is %s", (_label, blockers) => {
      expect(
        createStandupSchema.parse({ ...validInput, blockers }).blockers
      ).toBeNull();
    });

    it("accepts 1000 characters", () => {
      const blockers = "a".repeat(1000);
      expect(
        createStandupSchema.parse({ ...validInput, blockers }).blockers
      ).toBe(blockers);
    });

    it("rejects 1001 characters", () => {
      expect(
        fieldErrors({ ...validInput, blockers: "a".repeat(1001) }).blockers
      ).toEqual([TOO_LONG]);
    });

    it("rejects a value that isn't text", () => {
      expect(
        fieldErrors({ ...validInput, blockers: 42 }).blockers
      ).toHaveLength(1);
    });
  });

  it("reports every invalid field at once", () => {
    // Act
    const errors = fieldErrors({
      yesterday: "",
      today: "",
      blockers: "a".repeat(1001),
    });

    // Assert
    expect(errors).toEqual({
      yesterday: [YESTERDAY_REQUIRED],
      today: [TODAY_REQUIRED],
      blockers: [TOO_LONG],
    });
  });
});
