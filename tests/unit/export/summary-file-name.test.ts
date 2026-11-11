import { describe, expect, it } from "vitest";
import { getSummaryFileName } from "@/lib/export/summary-file-name";

const SPRINTS = [
  { id: "sprint-c", startDate: "2026-11-12" },
  { id: "sprint-a", startDate: "2026-10-29" },
  { id: "sprint-b", startDate: "2026-11-05" },
];

describe("getSummaryFileName", () => {
  it("uses the number in a Sprint N name", () => {
    // Act: the name wins over the sprint's place (first)
    const fileName = getSummaryFileName({
      sprint: { id: "sprint-a", name: "Sprint 2", startDate: "2026-10-29" },
      sprints: SPRINTS,
    });

    // Assert
    expect(fileName).toBe("sprint-2-summary.md");
  });

  it("uses the number of a name that starts with Sprint N", () => {
    // Act
    const fileName = getSummaryFileName({
      sprint: {
        id: "sprint-c",
        name: "Sprint 2 – catch-up",
        startDate: "2026-11-12",
      },
      sprints: SPRINTS,
    });

    // Assert
    expect(fileName).toBe("sprint-2-summary.md");
  });

  it("ignores case, spaces and leading zeros in the name", () => {
    // Act
    const fileName = getSummaryFileName({
      sprint: { id: "sprint-a", name: "sprint  03", startDate: "2026-10-29" },
      sprints: SPRINTS,
    });

    // Assert
    expect(fileName).toBe("sprint-3-summary.md");
  });

  it("uses the sprint's place among the team's sprints by start date for any other name", () => {
    // Act
    const fileName = getSummaryFileName({
      sprint: {
        id: "sprint-b",
        name: "Webhooks week",
        startDate: "2026-11-05",
      },
      sprints: SPRINTS,
    });

    // Assert
    expect(fileName).toBe("sprint-2-summary.md");
  });

  it("uses the place for a name with a number that doesn't follow Sprint", () => {
    // Act
    const fileName = getSummaryFileName({
      sprint: { id: "sprint-c", name: "Week 7", startDate: "2026-11-12" },
      sprints: SPRINTS,
    });

    // Assert
    expect(fileName).toBe("sprint-3-summary.md");
  });
});
