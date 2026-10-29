import { PrReviewInput } from "@/lib/checks/types";

let reviewCounter = 1;

export function createMockPrReview(overrides: Partial<PrReviewInput> = {}): PrReviewInput {
  const num = reviewCounter++;
  return {
    id: overrides.id ?? `review-${num}`,
    reviewerLogin: overrides.reviewerLogin ?? "user-1",
    reviewerId: overrides.reviewerId ?? "member-1",
    prId: overrides.prId ?? `pr-${num}`,
    prAuthorLogin: overrides.prAuthorLogin ?? "other-user",
    prAuthorId: overrides.prAuthorId ?? "other-member",
    state: overrides.state ?? "APPROVED",
    submittedAt: overrides.submittedAt ?? new Date("2026-10-30T19:00:00Z"),
    ...overrides,
  };
}
