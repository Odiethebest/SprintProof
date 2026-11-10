import { expect, it } from "vitest";
import { countStandupCharacters } from "@/lib/standups/character-count";
import { createStandupSchema } from "@/lib/standups/standup-input";
import { z } from "zod";

it.each([
  "a".repeat(1000),
  "a".repeat(1001),
  "😀".repeat(501),
  "😀".repeat(1000),
  "😀".repeat(1001),
  "  hello\n",
  " e\u0301 ",
])("counts trimmed code points the same way as Zod (%#)", (value) => {
  const count = countStandupCharacters({ value });
  expect(count).toBe([...value.trim()].length);
  expect(
    createStandupSchema.safeParse({ yesterday: value, today: "Work" }).success
  ).toBe(count > 0 && count <= 1000);
  expect(z.string().trim().max(1000).safeParse(value).success).toBe(
    count <= 1000
  );
});
