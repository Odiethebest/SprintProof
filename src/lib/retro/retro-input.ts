import { z } from "zod";
import { noNul } from "@/lib/validation/text";

export const RETRO_COLUMNS = ["WENT_WELL", "TO_IMPROVE"] as const;

export const MAX_RETRO_ITEM_LENGTH = 500;

const TEXT_REQUIRED = "Write the item first.";
const TEXT_TOO_LONG = `Use ${MAX_RETRO_ITEM_LENGTH} characters or fewer.`;
const COLUMN_UNKNOWN = "Pick Went well or To improve.";

// Shared by the retro items API and the "Add item" fields, so both show the
// same errors.
export const createRetroItemSchema = z.object({
  column: z.enum(RETRO_COLUMNS, { error: COLUMN_UNKNOWN }),
  text: z
    .string({ error: TEXT_REQUIRED })
    .trim()
    .min(1, TEXT_REQUIRED)
    .max(MAX_RETRO_ITEM_LENGTH, TEXT_TOO_LONG)
    .check(noNul),
});

export type CreateRetroItemInput = z.output<typeof createRetroItemSchema>;

// A retro can only be closed, never reopened: closing it made the action items.
export const closeRetroSchema = z.object({
  status: z.literal("CLOSED", {
    error: 'Send { "status": "CLOSED" } to close the retro.',
  }),
});

export const updateActionItemSchema = z.object({
  isDone: z.boolean({ error: "Send isDone as true or false." }),
});
