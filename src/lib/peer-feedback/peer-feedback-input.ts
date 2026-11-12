import { z } from "zod";
import { countStandupCharacters } from "@/lib/standups/character-count";
import { noNul } from "@/lib/validation/text";

export const MAX_PEER_FEEDBACK_LENGTH = 1000;

const TEXT_REQUIRED = "Write your feedback first.";
const TEXT_TOO_LONG = `Use ${MAX_PEER_FEEDBACK_LENGTH} characters or fewer.`;

// Shared by the peer feedback API and the PeerFeedbackForm, so both show the
// same errors. Feedback is counted like a standup answer: trimmed, in
// characters, so the counter under the field and the limit agree.
export const savePeerFeedbackSchema = z.object({
  text: z
    .string({ error: TEXT_REQUIRED })
    .trim()
    .min(1, TEXT_REQUIRED)
    .refine(
      (value) => countStandupCharacters({ value }) <= MAX_PEER_FEEDBACK_LENGTH,
      TEXT_TOO_LONG
    )
    .check(noNul),
});

export type SavePeerFeedbackInput = z.output<typeof savePeerFeedbackSchema>;
