import { describe, expect, it } from "vitest";
import {
  MAX_RETRO_ITEM_LENGTH,
  closeRetroSchema,
  createRetroItemSchema,
  updateActionItemSchema,
} from "@/lib/retro/retro-input";

function firstMessage(result: {
  success: boolean;
  error?: { issues: Array<{ message: string }> };
}): string | undefined {
  return result.error?.issues[0]?.message;
}

describe("createRetroItemSchema", () => {
  it.each(["WENT_WELL", "TO_IMPROVE"] as const)(
    "accepts an item for %s",
    (column) => {
      // Act
      const result = createRetroItemSchema.safeParse({
        column,
        text: "CI catches broken builds before review",
      });

      // Assert
      expect(result).toEqual({
        success: true,
        data: { column, text: "CI catches broken builds before review" },
      });
    }
  );

  it("trims spaces around the text", () => {
    // Act
    const result = createRetroItemSchema.safeParse({
      column: "TO_IMPROVE",
      text: "  Split the dashboard work into smaller PRs \n",
    });

    // Assert
    expect(result.data?.text).toBe("Split the dashboard work into smaller PRs");
  });

  it.each(["", "   ", undefined])("asks for text when it's %j", (text) => {
    // Act
    const result = createRetroItemSchema.safeParse({
      column: "WENT_WELL",
      text,
    });

    // Assert
    expect(result.success).toBe(false);
    expect(firstMessage(result)).toBe("Write the item first.");
  });

  it("accepts text of exactly the maximum length", () => {
    // Act
    const result = createRetroItemSchema.safeParse({
      column: "WENT_WELL",
      text: "a".repeat(MAX_RETRO_ITEM_LENGTH),
    });

    // Assert
    expect(result.success).toBe(true);
  });

  it("refuses text over the maximum length", () => {
    // Act
    const result = createRetroItemSchema.safeParse({
      column: "WENT_WELL",
      text: "a".repeat(MAX_RETRO_ITEM_LENGTH + 1),
    });

    // Assert
    expect(MAX_RETRO_ITEM_LENGTH).toBe(500);
    expect(firstMessage(result)).toBe("Use 500 characters or fewer.");
  });

  it("refuses a NUL character, which PostgreSQL can't store", () => {
    // Act
    const result = createRetroItemSchema.safeParse({
      column: "WENT_WELL",
      text: "bad\u0000text",
    });

    // Assert
    expect(firstMessage(result)).toBe("Text cannot contain a NUL character.");
  });

  it.each(["ACTION_ITEMS", "went_well", undefined])(
    "refuses the column %j",
    (column) => {
      // Act
      const result = createRetroItemSchema.safeParse({
        column,
        text: "Something",
      });

      // Assert
      expect(firstMessage(result)).toBe("Pick Went well or To improve.");
    }
  );
});

describe("closeRetroSchema", () => {
  it("accepts closing the retro", () => {
    // Act
    const result = closeRetroSchema.safeParse({ status: "CLOSED" });

    // Assert
    expect(result.success).toBe(true);
  });

  it.each([{ status: "OPEN" }, {}, { status: "closed" }])(
    "refuses %j, since a retro can only be closed",
    (body) => {
      // Act
      const result = closeRetroSchema.safeParse(body);

      // Assert
      expect(firstMessage(result)).toBe(
        'Send { "status": "CLOSED" } to close the retro.'
      );
    }
  );
});

describe("updateActionItemSchema", () => {
  it.each([true, false])("accepts isDone %s", (isDone) => {
    // Act
    const result = updateActionItemSchema.safeParse({ isDone });

    // Assert
    expect(result).toEqual({ success: true, data: { isDone } });
  });

  it.each(["true", 1, null, undefined])("refuses isDone %j", (isDone) => {
    // Act
    const result = updateActionItemSchema.safeParse({ isDone });

    // Assert
    expect(firstMessage(result)).toBe("Send isDone as true or false.");
  });
});
