import { errorResponse } from "@/server/api-response";
import type { PeerFeedbackRecord } from "@/server/repositories/peer-feedback";

// The peer feedback API's JSON shape (docs/api/openapi.yaml: PeerFeedback)
// and its errors (#14).

export function toPeerFeedbackResponse(feedback: PeerFeedbackRecord) {
  return {
    id: feedback.id,
    sprintId: feedback.sprintId,
    author: feedback.author,
    recipient: feedback.recipient,
    text: feedback.text,
    createdAt: feedback.createdAt,
    updatedAt: feedback.updatedAt,
  };
}

const PEER_FEEDBACK_ERRORS = {
  // Anyone who can't read feedback gets this, the same answer as a team or
  // sprint with none (rule R7).
  PEER_FEEDBACK_NOT_FOUND: {
    status: 404,
    code: "PEER_FEEDBACK_NOT_FOUND",
    message: "Peer feedback not found.",
  },
  RETRO_NOT_FOUND: {
    status: 404,
    code: "RETRO_NOT_FOUND",
    message: "The lead hasn't opened this sprint's retro yet.",
  },
  RETRO_CLOSED: {
    status: 409,
    code: "RETRO_CLOSED",
    message:
      "This sprint's retro is closed, so its partner feedback can't change.",
  },
  TEAMMATE_NOT_FOUND: {
    status: 404,
    code: "TEAMMATE_NOT_FOUND",
    message:
      "Teammate not found. Feedback is about another lead or member of this team.",
  },
} as const;

export type PeerFeedbackError = keyof typeof PEER_FEEDBACK_ERRORS;

export function peerFeedbackErrorResponse(error: PeerFeedbackError): Response {
  return errorResponse(PEER_FEEDBACK_ERRORS[error]);
}
