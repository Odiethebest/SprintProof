import { describe, expect, it } from "vitest";
import { parseBearerToken } from "@/lib/api-tokens/bearer-token";

// Same shape as a real token: the prefix and 43 base64url characters.
const TOKEN = `spk_live_${"a".repeat(39)}Zz_-`;

describe("parseBearerToken", () => {
  it("returns the token from a Bearer header", () => {
    // Act
    const token = parseBearerToken({ authorization: `Bearer ${TOKEN}` });

    // Assert
    expect(token).toBe(TOKEN);
  });

  it.each(["bearer", "BEARER"])(
    "accepts the scheme written as %s",
    (scheme) => {
      // Act
      const token = parseBearerToken({ authorization: `${scheme} ${TOKEN}` });

      // Assert
      expect(token).toBe(TOKEN);
    }
  );

  it("ignores extra spaces around the token", () => {
    // Act
    const token = parseBearerToken({ authorization: `Bearer   ${TOKEN}  ` });

    // Assert
    expect(token).toBe(TOKEN);
  });

  it.each([
    ["no header", null],
    ["an empty header", ""],
    ["another scheme", `Basic ${TOKEN}`],
    ["the scheme without a token", "Bearer"],
    ["the scheme and a space", "Bearer "],
    ["a token without the scheme", TOKEN],
    ["two values after the scheme", `Bearer ${TOKEN} extra`],
    [
      "a token from another service",
      "Bearer ghp_16C7e42F292c6912E7710c838347Ae178B4a",
    ],
    ["a token one character short", `Bearer ${TOKEN.slice(0, -1)}`],
    [
      "a token with a character outside base64url",
      `Bearer ${TOKEN.slice(0, -1)}=`,
    ],
  ])("returns null for %s", (_, authorization) => {
    // Act
    const token = parseBearerToken({ authorization });

    // Assert
    expect(token).toBeNull();
  });
});
