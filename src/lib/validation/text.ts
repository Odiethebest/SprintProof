import { z } from "zod";

export const noNul = z.refine<string>((value) => !value.includes("\u0000"), {
  error: "Text cannot contain a NUL character.",
});

// PostgreSQL cannot represent NUL in text. Invalid lookup keys behave as absent.
export const databaseTextSchema = z.string().min(1).check(noNul);
