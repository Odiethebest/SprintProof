import { describe, expect, it } from "vitest";
import {
  validateSprint,
  type ExistingSprint,
  type SprintInput,
} from "@/lib/sprints/validate-sprint";

function buildSprintInput(overrides: Partial<SprintInput> = {}): SprintInput {
  return {
    name: "Sprint 1",
    startDate: "2026-10-29",
    endDate: "2026-11-04",
    standupsPerPerson: 3,
    reviewsPerPerson: 5,
    ...overrides,
  };
}

function buildExistingSprint(
  overrides: Partial<ExistingSprint> = {},
): ExistingSprint {
  return {
    id: "sprint-1",
    name: "Sprint 1",
    startDate: "2026-10-29",
    endDate: "2026-11-04",
    ...overrides,
  };
}

describe("validateSprint", () => {
  describe("valid sprint inputs", () => {
    it("returns no errors for a valid sprint with no existing sprints", () => {
      // Arrange
      const sprint = buildSprintInput();

      // Act
      const errors = validateSprint({ sprint, existingSprints: [] });

      // Assert
      expect(errors).toEqual([]);
    });

    it("returns no errors when existing sprints do not overlap", () => {
      // Arrange
      const sprint = buildSprintInput({
        name: "Sprint 2",
        startDate: "2026-11-05",
        endDate: "2026-11-11",
      });
      const existing = buildExistingSprint({
        id: "sprint-1",
        name: "Sprint 1",
        startDate: "2026-10-29",
        endDate: "2026-11-04",
      });

      // Act
      const errors = validateSprint({ sprint, existingSprints: [existing] });

      // Assert
      expect(errors).toEqual([]);
    });

    it("allows a single-day sprint where start date equals end date", () => {
      // Arrange
      const sprint = buildSprintInput({
        startDate: "2026-11-05",
        endDate: "2026-11-05",
      });

      // Act
      const errors = validateSprint({ sprint, existingSprints: [] });

      // Assert
      expect(errors).toEqual([]);
    });

    it("allows a sprint that starts the day after an existing sprint ends", () => {
      // Arrange
      const existing = buildExistingSprint({
        id: "sprint-1",
        name: "Sprint 1",
        startDate: "2026-10-29",
        endDate: "2026-11-04",
      });
      const sprint = buildSprintInput({
        name: "Sprint 2",
        startDate: "2026-11-05",
        endDate: "2026-11-11",
      });

      // Act
      const errors = validateSprint({ sprint, existingSprints: [existing] });

      // Assert
      expect(errors).toEqual([]);
    });

    it("allows a sprint that ends the day before an existing sprint starts", () => {
      // Arrange
      const existing = buildExistingSprint({
        id: "sprint-2",
        name: "Sprint 2",
        startDate: "2026-11-05",
        endDate: "2026-11-11",
      });
      const sprint = buildSprintInput({
        name: "Sprint 1",
        startDate: "2026-10-29",
        endDate: "2026-11-04",
      });

      // Act
      const errors = validateSprint({ sprint, existingSprints: [existing] });

      // Assert
      expect(errors).toEqual([]);
    });

    it("allows boundary values of 1 and 20 for quotas", () => {
      // Arrange
      const sprint = buildSprintInput({
        standupsPerPerson: 1,
        reviewsPerPerson: 20,
      });

      // Act
      const errors = validateSprint({ sprint, existingSprints: [] });

      // Assert
      expect(errors).toEqual([]);
    });

    it("does not count the sprint itself as an overlap when editing", () => {
      // Arrange
      const existing = buildExistingSprint({
        id: "sprint-1",
        name: "Sprint 1",
        startDate: "2026-10-29",
        endDate: "2026-11-04",
      });
      const sprint = buildSprintInput({
        id: "sprint-1",
        name: "Sprint 1 (Updated)",
        startDate: "2026-10-29",
        endDate: "2026-11-04",
      });

      // Act
      const errors = validateSprint({ sprint, existingSprints: [existing] });

      // Assert
      expect(errors).toEqual([]);
    });
  });

  describe("date range validation", () => {
    it("reports an error when end date is before start date", () => {
      // Arrange
      const sprint = buildSprintInput({
        startDate: "2026-11-05",
        endDate: "2026-11-04",
      });

      // Act
      const errors = validateSprint({ sprint, existingSprints: [] });

      // Assert
      expect(errors).toContainEqual({
        field: "endDate",
        code: "END_DATE_BEFORE_START",
        message: expect.stringMatching(/end date/i),
      });
    });
  });

  describe("overlap validation", () => {
    it("reports an error when the start date falls within an existing sprint", () => {
      // Arrange
      const existing = buildExistingSprint({
        id: "sprint-1",
        name: "Sprint 1",
        startDate: "2026-10-29",
        endDate: "2026-11-04",
      });
      const sprint = buildSprintInput({
        name: "Sprint 2",
        startDate: "2026-11-02",
        endDate: "2026-11-08",
      });

      // Act
      const errors = validateSprint({ sprint, existingSprints: [existing] });

      // Assert
      expect(errors).toContainEqual({
        field: "startDate",
        code: "OVERLAPPING_SPRINT",
        message: expect.stringContaining("Sprint 1"),
      });
    });

    it("reports an error when the end date falls within an existing sprint", () => {
      // Arrange
      const existing = buildExistingSprint({
        id: "sprint-2",
        name: "Sprint 2",
        startDate: "2026-11-05",
        endDate: "2026-11-11",
      });
      const sprint = buildSprintInput({
        name: "Sprint 1",
        startDate: "2026-10-29",
        endDate: "2026-11-06",
      });

      // Act
      const errors = validateSprint({ sprint, existingSprints: [existing] });

      // Assert
      expect(errors).toContainEqual({
        field: "startDate",
        code: "OVERLAPPING_SPRINT",
        message: expect.stringContaining("Sprint 2"),
      });
    });

    it("reports an error when the sprint completely encloses an existing sprint", () => {
      // Arrange
      const existing = buildExistingSprint({
        id: "sprint-1",
        name: "Sprint 1",
        startDate: "2026-11-01",
        endDate: "2026-11-03",
      });
      const sprint = buildSprintInput({
        name: "Sprint Big",
        startDate: "2026-10-29",
        endDate: "2026-11-05",
      });

      // Act
      const errors = validateSprint({ sprint, existingSprints: [existing] });

      // Assert
      expect(errors).toContainEqual({
        field: "startDate",
        code: "OVERLAPPING_SPRINT",
        message: expect.stringContaining("Sprint 1"),
      });
    });

    it("reports an error when the sprint is completely enclosed by an existing sprint", () => {
      // Arrange
      const existing = buildExistingSprint({
        id: "sprint-1",
        name: "Sprint 1",
        startDate: "2026-10-29",
        endDate: "2026-11-10",
      });
      const sprint = buildSprintInput({
        name: "Sprint Mini",
        startDate: "2026-11-01",
        endDate: "2026-11-03",
      });

      // Act
      const errors = validateSprint({ sprint, existingSprints: [existing] });

      // Assert
      expect(errors).toContainEqual({
        field: "startDate",
        code: "OVERLAPPING_SPRINT",
        message: expect.stringContaining("Sprint 1"),
      });
    });

    it("reports an error when the start date equals an existing sprint's end date", () => {
      // Arrange
      const existing = buildExistingSprint({
        id: "sprint-1",
        name: "Sprint 1",
        startDate: "2026-10-29",
        endDate: "2026-11-04",
      });
      const sprint = buildSprintInput({
        name: "Sprint 2",
        startDate: "2026-11-04",
        endDate: "2026-11-10",
      });

      // Act
      const errors = validateSprint({ sprint, existingSprints: [existing] });

      // Assert
      expect(errors).toContainEqual({
        field: "startDate",
        code: "OVERLAPPING_SPRINT",
        message: expect.stringContaining("Sprint 1"),
      });
    });

    it("reports an error when the end date equals an existing sprint's start date", () => {
      // Arrange
      const existing = buildExistingSprint({
        id: "sprint-2",
        name: "Sprint 2",
        startDate: "2026-11-05",
        endDate: "2026-11-11",
      });
      const sprint = buildSprintInput({
        name: "Sprint 1",
        startDate: "2026-10-29",
        endDate: "2026-11-05",
      });

      // Act
      const errors = validateSprint({ sprint, existingSprints: [existing] });

      // Assert
      expect(errors).toContainEqual({
        field: "startDate",
        code: "OVERLAPPING_SPRINT",
        message: expect.stringContaining("Sprint 2"),
      });
    });

    it("reports an error naming another sprint when editing causes collision with a different sprint", () => {
      // Arrange
      const sprint1 = buildExistingSprint({
        id: "sprint-1",
        name: "Sprint 1",
        startDate: "2026-10-29",
        endDate: "2026-11-04",
      });
      const sprint2 = buildExistingSprint({
        id: "sprint-2",
        name: "Sprint 2",
        startDate: "2026-11-05",
        endDate: "2026-11-11",
      });
      // Editing sprint-1 to extend into sprint-2's dates
      const sprint = buildSprintInput({
        id: "sprint-1",
        name: "Sprint 1",
        startDate: "2026-10-29",
        endDate: "2026-11-06",
      });

      // Act
      const errors = validateSprint({
        sprint,
        existingSprints: [sprint1, sprint2],
      });

      // Assert
      expect(errors).toContainEqual({
        field: "startDate",
        code: "OVERLAPPING_SPRINT",
        message: expect.stringContaining("Sprint 2"),
      });
    });

    it("names the correct conflicting sprint among multiple non-conflicting sprints", () => {
      // Arrange
      const sprint1 = buildExistingSprint({
        id: "sprint-1",
        name: "Sprint 1",
        startDate: "2026-10-01",
        endDate: "2026-10-07",
      });
      const sprint2 = buildExistingSprint({
        id: "sprint-2",
        name: "Sprint 2",
        startDate: "2026-10-15",
        endDate: "2026-10-21",
      });
      const newSprint = buildSprintInput({
        name: "Sprint New",
        startDate: "2026-10-20",
        endDate: "2026-10-27",
      });

      // Act
      const errors = validateSprint({
        sprint: newSprint,
        existingSprints: [sprint1, sprint2],
      });

      // Assert
      expect(errors).toContainEqual({
        field: "startDate",
        code: "OVERLAPPING_SPRINT",
        message: expect.stringContaining("Sprint 2"),
      });
    });
  });

  describe("quota requirements validation", () => {
    it("reports an error when standupsPerPerson is less than 1", () => {
      // Arrange
      const sprint = buildSprintInput({ standupsPerPerson: 0 });

      // Act
      const errors = validateSprint({ sprint, existingSprints: [] });

      // Assert
      expect(errors).toContainEqual({
        field: "standupsPerPerson",
        code: "OUT_OF_RANGE",
        message: expect.stringMatching(/between 1 and 20/i),
      });
    });

    it("reports an error when standupsPerPerson is negative", () => {
      // Arrange
      const sprint = buildSprintInput({ standupsPerPerson: -1 });

      // Act
      const errors = validateSprint({ sprint, existingSprints: [] });

      // Assert
      expect(errors).toContainEqual({
        field: "standupsPerPerson",
        code: "OUT_OF_RANGE",
        message: expect.stringMatching(/between 1 and 20/i),
      });
    });

    it("reports an error when standupsPerPerson is greater than 20", () => {
      // Arrange
      const sprint = buildSprintInput({ standupsPerPerson: 21 });

      // Act
      const errors = validateSprint({ sprint, existingSprints: [] });

      // Assert
      expect(errors).toContainEqual({
        field: "standupsPerPerson",
        code: "OUT_OF_RANGE",
        message: expect.stringMatching(/between 1 and 20/i),
      });
    });

    it("reports an error when standupsPerPerson is not an integer", () => {
      // Arrange
      const sprint = buildSprintInput({ standupsPerPerson: 3.5 });

      // Act
      const errors = validateSprint({ sprint, existingSprints: [] });

      // Assert
      expect(errors).toContainEqual({
        field: "standupsPerPerson",
        code: "INVALID_INTEGER",
        message: expect.stringMatching(/integer/i),
      });
    });

    it("reports an error when standupsPerPerson is NaN", () => {
      // Arrange
      const sprint = buildSprintInput({ standupsPerPerson: Number.NaN });

      // Act
      const errors = validateSprint({ sprint, existingSprints: [] });

      // Assert
      expect(errors).toContainEqual({
        field: "standupsPerPerson",
        code: "INVALID_INTEGER",
        message: expect.stringMatching(/integer/i),
      });
    });

    it("reports an error when reviewsPerPerson is less than 1", () => {
      // Arrange
      const sprint = buildSprintInput({ reviewsPerPerson: 0 });

      // Act
      const errors = validateSprint({ sprint, existingSprints: [] });

      // Assert
      expect(errors).toContainEqual({
        field: "reviewsPerPerson",
        code: "OUT_OF_RANGE",
        message: expect.stringMatching(/between 1 and 20/i),
      });
    });

    it("reports an error when reviewsPerPerson is negative", () => {
      // Arrange
      const sprint = buildSprintInput({ reviewsPerPerson: -3 });

      // Act
      const errors = validateSprint({ sprint, existingSprints: [] });

      // Assert
      expect(errors).toContainEqual({
        field: "reviewsPerPerson",
        code: "OUT_OF_RANGE",
        message: expect.stringMatching(/between 1 and 20/i),
      });
    });

    it("reports an error when reviewsPerPerson is greater than 20", () => {
      // Arrange
      const sprint = buildSprintInput({ reviewsPerPerson: 25 });

      // Act
      const errors = validateSprint({ sprint, existingSprints: [] });

      // Assert
      expect(errors).toContainEqual({
        field: "reviewsPerPerson",
        code: "OUT_OF_RANGE",
        message: expect.stringMatching(/between 1 and 20/i),
      });
    });

    it("reports an error when reviewsPerPerson is not an integer", () => {
      // Arrange
      const sprint = buildSprintInput({ reviewsPerPerson: 5.2 });

      // Act
      const errors = validateSprint({ sprint, existingSprints: [] });

      // Assert
      expect(errors).toContainEqual({
        field: "reviewsPerPerson",
        code: "INVALID_INTEGER",
        message: expect.stringMatching(/integer/i),
      });
    });

    it("reports an error when reviewsPerPerson is NaN", () => {
      // Arrange
      const sprint = buildSprintInput({ reviewsPerPerson: Number.NaN });

      // Act
      const errors = validateSprint({ sprint, existingSprints: [] });

      // Assert
      expect(errors).toContainEqual({
        field: "reviewsPerPerson",
        code: "INVALID_INTEGER",
        message: expect.stringMatching(/integer/i),
      });
    });
  });

  describe("date format validation", () => {
    it("rejects non-YYYY-MM-DD format for startDate", () => {
      // Arrange
      const sprint = buildSprintInput({ startDate: "10/29/2026" });

      // Act
      const errors = validateSprint({ sprint, existingSprints: [] });

      // Assert
      expect(errors).toContainEqual({
        field: "startDate",
        code: "INVALID_DATE_FORMAT",
        message: expect.stringMatching(/YYYY-MM-DD/i),
      });
    });

    it("rejects non-existent calendar date for startDate (e.g., Feb 30)", () => {
      // Arrange
      const sprint = buildSprintInput({ startDate: "2026-02-30" });

      // Act
      const errors = validateSprint({ sprint, existingSprints: [] });

      // Assert
      expect(errors).toContainEqual({
        field: "startDate",
        code: "INVALID_DATE_FORMAT",
        message: expect.stringMatching(/valid calendar date/i),
      });
    });

    it("rejects a Date object passed as startDate", () => {
      // Arrange
      const sprint = buildSprintInput({
        startDate: new Date("2026-10-29") as unknown as string,
      });

      // Act
      const errors = validateSprint({ sprint, existingSprints: [] });

      // Assert
      expect(errors).toContainEqual({
        field: "startDate",
        code: "INVALID_DATE_FORMAT",
        message: expect.stringMatching(/YYYY-MM-DD/i),
      });
    });

    it("rejects non-YYYY-MM-DD format for endDate", () => {
      // Arrange
      const sprint = buildSprintInput({ endDate: "2026.11.04" });

      // Act
      const errors = validateSprint({ sprint, existingSprints: [] });

      // Assert
      expect(errors).toContainEqual({
        field: "endDate",
        code: "INVALID_DATE_FORMAT",
        message: expect.stringMatching(/YYYY-MM-DD/i),
      });
    });

    it("rejects non-existent calendar date for endDate (e.g., Nov 31)", () => {
      // Arrange
      const sprint = buildSprintInput({ endDate: "2026-11-31" });

      // Act
      const errors = validateSprint({ sprint, existingSprints: [] });

      // Assert
      expect(errors).toContainEqual({
        field: "endDate",
        code: "INVALID_DATE_FORMAT",
        message: expect.stringMatching(/valid calendar date/i),
      });
    });

    it("rejects a Date object passed as endDate", () => {
      // Arrange
      const sprint = buildSprintInput({
        endDate: new Date("2026-11-04") as unknown as string,
      });

      // Act
      const errors = validateSprint({ sprint, existingSprints: [] });

      // Assert
      expect(errors).toContainEqual({
        field: "endDate",
        code: "INVALID_DATE_FORMAT",
        message: expect.stringMatching(/YYYY-MM-DD/i),
      });
    });
  });

  describe("sprint name validation", () => {
    it("reports an error when name is empty", () => {
      // Arrange
      const sprint = buildSprintInput({ name: "" });

      // Act
      const errors = validateSprint({ sprint, existingSprints: [] });

      // Assert
      expect(errors).toContainEqual({
        field: "name",
        code: "REQUIRED",
        message: expect.stringMatching(/name is required/i),
      });
    });

    it("reports an error when name is only whitespace", () => {
      // Arrange
      const sprint = buildSprintInput({ name: "   " });

      // Act
      const errors = validateSprint({ sprint, existingSprints: [] });

      // Assert
      expect(errors).toContainEqual({
        field: "name",
        code: "REQUIRED",
        message: expect.stringMatching(/name is required/i),
      });
    });
  });

  describe("multiple validation errors", () => {
    it("returns errors for all invalid fields when multiple fields are invalid", () => {
      // Arrange
      const sprint = buildSprintInput({
        name: "",
        startDate: "invalid-date",
        endDate: "2026-11-04",
        standupsPerPerson: 0,
        reviewsPerPerson: 25,
      });

      // Act
      const errors = validateSprint({ sprint, existingSprints: [] });

      // Assert
      expect(errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: "name", code: "REQUIRED" }),
          expect.objectContaining({
            field: "startDate",
            code: "INVALID_DATE_FORMAT",
          }),
          expect.objectContaining({
            field: "standupsPerPerson",
            code: "OUT_OF_RANGE",
          }),
          expect.objectContaining({
            field: "reviewsPerPerson",
            code: "OUT_OF_RANGE",
          }),
        ]),
      );
    });
  });
});
