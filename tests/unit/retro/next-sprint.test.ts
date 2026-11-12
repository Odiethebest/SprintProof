import { describe, expect, it } from "vitest";
import { findNextSprint } from "@/lib/retro/next-sprint";

const SPRINT_1 = { id: "sprint-1", name: "Sprint 1", startDate: "2026-10-29" };
const SPRINT_2 = { id: "sprint-2", name: "Sprint 2", startDate: "2026-11-05" };
const SPRINT_3 = { id: "sprint-3", name: "Sprint 3", startDate: "2026-11-12" };

describe("findNextSprint", () => {
  it("finds the sprint that starts next after this one", () => {
    // Act
    const next = findNextSprint({
      sprint: SPRINT_1,
      sprints: [SPRINT_1, SPRINT_2, SPRINT_3],
    });

    // Assert
    expect(next).toEqual(SPRINT_2);
  });

  it("goes by start date, not by the order the sprints were added in", () => {
    // Act
    const next = findNextSprint({
      sprint: SPRINT_1,
      sprints: [SPRINT_3, SPRINT_1, SPRINT_2],
    });

    // Assert
    expect(next?.id).toBe("sprint-2");
  });

  it("never picks an earlier sprint", () => {
    // Act
    const next = findNextSprint({
      sprint: SPRINT_2,
      sprints: [SPRINT_1, SPRINT_2],
    });

    // Assert
    expect(next).toBeNull();
  });

  it("finds nothing when the team has only this sprint", () => {
    // Act
    const next = findNextSprint({ sprint: SPRINT_1, sprints: [SPRINT_1] });

    // Assert
    expect(next).toBeNull();
  });
});
