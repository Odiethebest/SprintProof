import { describe, expect, it } from "vitest";
import {
  MAX_PEER_FEEDBACK_LENGTH,
  savePeerFeedbackSchema,
} from "@/lib/peer-feedback/peer-feedback-input";

function firstMessage(result: {
  success: boolean;
  error?: { issues: Array<{ message: string }> };
}): string | undefined {
  return result.error?.issues[0]?.message;
}

describe("savePeerFeedbackSchema", () => {
  it("accepts feedback text", () => {
    // Act
    const result = savePeerFeedbackSchema.safeParse({
      text: "Explains decisions well in PR descriptions.",
    });

    // Assert
    expect(result).toEqual({
      success: true,
      data: { text: "Explains decisions well in PR descriptions." },
    });
  });

  it("trims spaces around the text but keeps its line breaks", () => {
    // Act
    const result = savePeerFeedbackSchema.safeParse({
      text: "  Reviews were thorough.\n\nSome waited a day. \n",
    });

    // Assert
    expect(result.data?.text).toBe(
      "Reviews were thorough.\n\nSome waited a day."
    );
  });

  it.each(["", "   \n ", undefined, null, 42])(
    "asks for feedback when the text is %j",
    (text) => {
      // Act
      const result = savePeerFeedbackSchema.safeParse({ text });

      // Assert
      expect(result.success).toBe(false);
      expect(firstMessage(result)).toBe("Write your feedback first.");
    }
  );

  it("accepts text of exactly 1000 characters", () => {
    // Act
    const result = savePeerFeedbackSchema.safeParse({
      text: "a".repeat(MAX_PEER_FEEDBACK_LENGTH),
    });

    // Assert
    expect(MAX_PEER_FEEDBACK_LENGTH).toBe(1000);
    expect(result.success).toBe(true);
  });

  it("counts an emoji as one character, like the counter under the field", () => {
    // Act: 1000 characters, 1001 UTF-16 code units
    const result = savePeerFeedbackSchema.safeParse({
      text: `${"a".repeat(MAX_PEER_FEEDBACK_LENGTH - 1)}👍`,
    });

    // Assert
    expect(result.success).toBe(true);
  });

  it("refuses text over 1000 characters", () => {
    // Act
    const result = savePeerFeedbackSchema.safeParse({
      text: "a".repeat(MAX_PEER_FEEDBACK_LENGTH + 1),
    });

    // Assert
    expect(firstMessage(result)).toBe("Use 1000 characters or fewer.");
  });

  it("refuses a NUL character, which PostgreSQL can't store", () => {
    // Act
    const result = savePeerFeedbackSchema.safeParse({
      text: "bad\u0000feedback",
    });

    // Assert
    expect(firstMessage(result)).toBe("Text cannot contain a NUL character.");
  });
});
