import { describe, expect, it } from "vitest";
import type {
  RequirementProgress,
  RequirementStatus,
} from "@/lib/checks/requirement-status";
import { summarizeRequirements } from "@/lib/checks/requirement-summary";

function progress(
  count: number,
  required: number,
  status: RequirementStatus
): RequirementProgress {
  return {
    count,
    required,
    remaining: Math.max(0, required - count),
    status,
  };
}

describe("summarizeRequirements", () => {
  it("names the open requirement and how many are left", () => {
    // Act
    const summary = summarizeRequirements({
      sprintName: "Sprint 1",
      standups: progress(3, 3, "MET"),
      reviews: progress(2, 5, "AT_RISK"),
      isSprintEnded: false,
    });

    // Assert
    expect(summary).toEqual({
      status: "AT_RISK",
      sentence: "You've met 1 of 2 requirements. 3 PR reviews to go.",
    });
  });

  it("lists both requirements when neither is met", () => {
    const summary = summarizeRequirements({
      sprintName: "Sprint 1",
      standups: progress(2, 3, "ON_TRACK"),
      reviews: progress(0, 5, "ON_TRACK"),
      isSprintEnded: false,
    });

    expect(summary).toEqual({
      status: "ON_TRACK",
      sentence:
        "You've met 0 of 2 requirements. 1 standup and 5 PR reviews to go.",
    });
  });

  it("uses the singular for one PR review and the plural for several standups", () => {
    const summary = summarizeRequirements({
      sprintName: "Sprint 1",
      standups: progress(1, 3, "ON_TRACK"),
      reviews: progress(4, 5, "ON_TRACK"),
      isSprintEnded: false,
    });

    expect(summary.sentence).toBe(
      "You've met 0 of 2 requirements. 2 standups and 1 PR review to go."
    );
  });

  it("shows the least favorable status of the open requirements", () => {
    // AT_RISK is less favorable than ON_TRACK
    const summary = summarizeRequirements({
      sprintName: "Sprint 1",
      standups: progress(1, 3, "ON_TRACK"),
      reviews: progress(0, 5, "AT_RISK"),
      isSprintEnded: false,
    });

    expect(summary.status).toBe("AT_RISK");
  });

  it("says every requirement is met when both are", () => {
    const summary = summarizeRequirements({
      sprintName: "Sprint 1",
      standups: progress(3, 3, "MET"),
      reviews: progress(6, 5, "MET"),
      isSprintEnded: false,
    });

    expect(summary).toEqual({
      status: "MET",
      sentence: "You've met 2 of 2 requirements.",
    });
  });

  it("says the sprint has ended and how many were met", () => {
    const summary = summarizeRequirements({
      sprintName: "Sprint 1",
      standups: progress(3, 3, "MET"),
      reviews: progress(2, 5, "MISSED"),
      isSprintEnded: true,
    });

    expect(summary).toEqual({
      status: "MISSED",
      sentence: "Sprint 1 has ended. You met 1 of 2 requirements.",
    });
  });

  it("shows Met for an ended sprint where both were met", () => {
    const summary = summarizeRequirements({
      sprintName: "Sprint 2",
      standups: progress(4, 3, "MET"),
      reviews: progress(5, 5, "MET"),
      isSprintEnded: true,
    });

    expect(summary).toEqual({
      status: "MET",
      sentence: "Sprint 2 has ended. You met 2 of 2 requirements.",
    });
  });
});
