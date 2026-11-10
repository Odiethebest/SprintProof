import { z } from "zod";
import { noNul } from "@/lib/validation/text";

export const MAX_API_TOKEN_NAME_LENGTH = 50;

const NAME_REQUIRED = "Name the token.";
const NAME_TOO_LONG = `Keep the name to ${MAX_API_TOKEN_NAME_LENGTH} characters or fewer.`;

// Shared by the tokens API and the API tokens card, so both show the same errors.
export const createApiTokenSchema = z.object({
  name: z
    .string({ error: NAME_REQUIRED })
    .trim()
    .min(1, NAME_REQUIRED)
    .max(MAX_API_TOKEN_NAME_LENGTH, NAME_TOO_LONG)
    .check(noNul),
});

export type CreateApiTokenInput = z.output<typeof createApiTokenSchema>;
