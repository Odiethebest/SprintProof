import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  API_TOKEN_PREFIX,
  createApiTokenSchema,
  hashApiToken,
  maskApiToken,
  toStoredApiToken,
} from "@/lib/api-tokens/api-token";

const TOKEN = `${API_TOKEN_PREFIX}Zm9vYmFyYmF6cXV4cXV1eGNvcmdlZ3JhdWx0Z2FycGx5`;

describe("createApiTokenSchema", () => {
  it("accepts a name and trims the spaces around it", () => {
    // Act
    const result = createApiTokenSchema.safeParse({
      name: "  Grading script ",
    });

    // Assert
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ name: "Grading script" });
  });

  it.each([
    ["an empty name", { name: "" }],
    ["a name of only spaces", { name: "   " }],
    ["a missing name", {}],
  ])("asks for a name when given %s", (_, input) => {
    // Act
    const result = createApiTokenSchema.safeParse(input);

    // Assert
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Name the token.");
  });

  it("accepts a 50-character name", () => {
    // Act
    const result = createApiTokenSchema.safeParse({ name: "a".repeat(50) });

    // Assert
    expect(result.success).toBe(true);
  });

  it("rejects a name longer than 50 characters", () => {
    // Act
    const result = createApiTokenSchema.safeParse({ name: "a".repeat(51) });

    // Assert
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      "Keep the name to 50 characters or fewer."
    );
  });
});

describe("hashApiToken", () => {
  it("returns the token's SHA-256 hash in hex", () => {
    // Arrange
    const expected = crypto.createHash("sha256").update(TOKEN).digest("hex");

    // Act
    const hash = hashApiToken({ token: TOKEN });

    // Assert
    expect(hash).toBe(expected);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("gives different tokens different hashes", () => {
    // Act
    const first = hashApiToken({ token: TOKEN });
    const second = hashApiToken({ token: `${TOKEN}x` });

    // Assert
    expect(first).not.toBe(second);
  });
});

describe("toStoredApiToken", () => {
  it("keeps only the hash and the last 4 characters of the token", () => {
    // Act
    const stored = toStoredApiToken({ token: TOKEN });

    // Assert
    expect(stored).toEqual({
      tokenHash: hashApiToken({ token: TOKEN }),
      last4: "cGx5",
    });
    expect(JSON.stringify(stored)).not.toContain(TOKEN);
  });
});

describe("maskApiToken", () => {
  it("shows the prefix, four dots and the last 4 characters", () => {
    // Act
    const masked = maskApiToken({ last4: "3f9a" });

    // Assert
    expect(masked).toBe("spk_live_••••3f9a");
  });
});
