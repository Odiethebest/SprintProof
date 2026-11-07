import { z } from "zod";

export const MAX_STANDUP_FIELD_LENGTH = 1000;

const YESTERDAY_REQUIRED = "Add what you worked on yesterday.";
const TODAY_REQUIRED = "Add what you plan to work on today.";
const BLOCKERS_NOT_TEXT = "Write blockers as text, or leave them empty.";
const TOO_LONG = `Use ${MAX_STANDUP_FIELD_LENGTH} characters or fewer.`;

function requiredField(message: string) {
  return z
    .string({ error: message })
    .trim()
    .min(1, message)
    .max(MAX_STANDUP_FIELD_LENGTH, TOO_LONG);
}

// Shared by the standups API and the StandupForm, so both show the same errors.
// The server picks the sprint and the date (rule R2), so the schema has no field for either.
export const createStandupSchema = z.object({
  yesterday: requiredField(YESTERDAY_REQUIRED),
  today: requiredField(TODAY_REQUIRED),
  blockers: z
    .string({ error: BLOCKERS_NOT_TEXT })
    .trim()
    .max(MAX_STANDUP_FIELD_LENGTH, TOO_LONG)
    .nullish()
    // Blockers are optional; an empty answer is stored as null so the history shows "None".
    .transform((blockers) => (blockers ? blockers : null)),
});

export type CreateStandupInput = z.output<typeof createStandupSchema>;
