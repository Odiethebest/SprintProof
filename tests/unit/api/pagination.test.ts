import { describe, expect, it } from "vitest";
import { paginationQuerySchema, toPage } from "@/lib/api/pagination";

const LIMIT_MESSAGE = "Set limit to a whole number from 1 to 100.";

describe("paginationQuerySchema", () => {
  it("uses a limit of 20 and no cursor when the query has neither", () => {
    // Act
    const query = paginationQuerySchema.parse({});

    // Assert
    expect(query).toEqual({ limit: 20 });
  });

  it("reads the limit and the cursor from query strings", () => {
    // Act
    const query = paginationQuerySchema.parse({ limit: "5", cursor: "abc123" });

    // Assert
    expect(query).toEqual({ limit: 5, cursor: "abc123" });
  });

  it.each([
    ["1", 1],
    ["100", 100],
  ])("accepts a limit of %s", (limit, expected) => {
    // Act
    const query = paginationQuerySchema.parse({ limit });

    // Assert
    expect(query.limit).toBe(expected);
  });

  it.each(["0", "101", "-1", "2.5", "ten", ""])(
    "rejects a limit of %j with one message",
    (limit) => {
      // Act
      const result = paginationQuerySchema.safeParse({ limit });

      // Assert
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe(LIMIT_MESSAGE);
    }
  );

  it("rejects an empty cursor", () => {
    // Act
    const result = paginationQuerySchema.safeParse({ cursor: "" });

    // Assert
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      "Set cursor to the nextCursor from the previous page."
    );
  });
});

// Repositories fetch one row more than the limit, so toPage() can tell
// whether another page follows.
describe("toPage", () => {
  it("returns every row and no cursor when the rows fit in the limit", () => {
    // Arrange
    const rows = [{ id: "a" }, { id: "b" }];

    // Act
    const page = toPage({ rows, limit: 2 });

    // Assert
    expect(page).toEqual({
      data: [{ id: "a" }, { id: "b" }],
      nextCursor: null,
    });
  });

  it("drops the extra row and points the cursor at the last row returned", () => {
    // Arrange
    const rows = [{ id: "a" }, { id: "b" }, { id: "c" }];

    // Act
    const page = toPage({ rows, limit: 2 });

    // Assert
    expect(page).toEqual({ data: [{ id: "a" }, { id: "b" }], nextCursor: "b" });
  });

  it("returns an empty page with no cursor when there are no rows", () => {
    // Act
    const page = toPage({ rows: [], limit: 20 });

    // Assert
    expect(page).toEqual({ data: [], nextCursor: null });
  });
});
