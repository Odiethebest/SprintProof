import { describe, expect, it } from "vitest";

describe("sample test suite", () => {
  it("asserts basic arithmetic truth", () => {
    // Arrange
    const a = 1;
    const b = 2;

    // Act
    const result = a + b;

    // Assert
    expect(result).toBe(3);
  });
});
