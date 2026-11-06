import { z } from "zod";

export const NETWORK_ERROR_MESSAGE =
  "Couldn't reach SprintProof. Check your connection and try again.";
export const UNKNOWN_ERROR_MESSAGE = "Something went wrong. Try again.";

// AGENTS.md §1: every API error is { error: { code, message } }.
const apiErrorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
});

export async function readApiError(
  response: Response
): Promise<{ code: string; message: string }> {
  const body: unknown = await response.json().catch(() => null);
  const parsed = apiErrorSchema.safeParse(body);
  return parsed.success
    ? parsed.data.error
    : { code: "UNKNOWN", message: UNKNOWN_ERROR_MESSAGE };
}
