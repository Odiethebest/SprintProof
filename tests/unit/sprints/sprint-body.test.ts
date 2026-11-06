import { describe, expect, it } from "vitest";
import { createSprintSchema, updateSprintSchema } from "@/lib/sprints";

const VALID_SPRINT = {
  name: "Sprint 1",
  startDate: "2026-10-29",
  endDate: "2026-11-04",
};

function firstMessage(result: {
  success: boolean;
  error?: { issues: { message: string }[] };
}): string | undefined {
  return result.error?.issues[0]?.message;
}

describe("createSprintSchema", () => {
  it("defaults to 3 standups and 5 PR reviews per person", () => {
    // Act
    const result = createSprintSchema.parse(VALID_SPRINT);

    // Assert
    expect(result).toEqual({
      ...VALID_SPRINT,
      standupsPerPerson: 3,
      reviewsPerPerson: 5,
    });
  });

  it("keeps the requirements it is sent", () => {
    // Act
    const result = createSprintSchema.parse({
      ...VALID_SPRINT,
      standupsPerPerson: 4,
      reviewsPerPerson: 6,
    });

    // Assert
    expect(result).toMatchObject({ standupsPerPerson: 4, reviewsPerPerson: 6 });
  });

  it("drops fields it doesn't know, such as teamId", () => {
    // Act
    const result = createSprintSchema.parse({
      ...VALID_SPRINT,
      teamId: "another-team",
    });

    // Assert
    expect(result).not.toHaveProperty("teamId");
  });

  it.each([
    ["name", "Sprint name is required."],
    ["startDate", "Start date is required."],
    ["endDate", "End date is required."],
  ])("asks for %s when it is missing", (field, message) => {
    // Arrange
    const input: Record<string, unknown> = { ...VALID_SPRINT };
    delete input[field];

    // Act
    const result = createSprintSchema.safeParse(input);

    // Assert
    expect(result.success).toBe(false);
    expect(firstMessage(result)).toBe(message);
  });

  it.each([
    ["a name that isn't text", { name: 42 }, "Sprint name must be text."],
    [
      "a start date that isn't a string",
      { startDate: 20261029 },
      "Start date must be a valid calendar date in YYYY-MM-DD format.",
    ],
    [
      "an end date that is null",
      { endDate: null },
      "End date must be a valid calendar date in YYYY-MM-DD format.",
    ],
    [
      "standups per person sent as a string",
      { standupsPerPerson: "5" },
      "Standups per person must be an integer.",
    ],
    [
      "reviews per person sent as null",
      { reviewsPerPerson: null },
      "Reviews per person must be an integer.",
    ],
  ])("rejects %s", (_label, override, message) => {
    // Act
    const result = createSprintSchema.safeParse({
      ...VALID_SPRINT,
      ...override,
    });

    // Assert
    expect(result.success).toBe(false);
    expect(firstMessage(result)).toBe(message);
  });

  it("rejects a body that isn't an object", () => {
    // Act
    const result = createSprintSchema.safeParse([VALID_SPRINT]);

    // Assert
    expect(result.success).toBe(false);
    expect(firstMessage(result)).toBe("Send the sprint as a JSON object.");
  });

  it("leaves value rules (blank name, calendar dates, 1–20) to validateSprint", () => {
    // Act
    const result = createSprintSchema.safeParse({
      name: "   ",
      startDate: "2026-02-30",
      endDate: "not-a-date",
      standupsPerPerson: 0,
      reviewsPerPerson: 2.5,
    });

    // Assert
    expect(result.success).toBe(true);
  });
});

describe("updateSprintSchema", () => {
  it("accepts an empty edit", () => {
    // Act
    const result = updateSprintSchema.parse({});

    // Assert
    expect(result).toEqual({});
  });

  it("doesn't fill in requirements it isn't sent", () => {
    // Act
    const result = updateSprintSchema.parse({ name: "Sprint 1 (Renamed)" });

    // Assert
    expect(result).toEqual({ name: "Sprint 1 (Renamed)" });
  });

  it.each([
    ["a name that isn't text", { name: 123 }, "Sprint name must be text."],
    [
      "a null start date",
      { startDate: null },
      "Start date must be a valid calendar date in YYYY-MM-DD format.",
    ],
    [
      "an end date sent as a number",
      { endDate: 20261110 },
      "End date must be a valid calendar date in YYYY-MM-DD format.",
    ],
    [
      "reviews per person sent as a string",
      { reviewsPerPerson: "6" },
      "Reviews per person must be an integer.",
    ],
  ])("rejects %s", (_label, body, message) => {
    // Act
    const result = updateSprintSchema.safeParse(body);

    // Assert
    expect(result.success).toBe(false);
    expect(firstMessage(result)).toBe(message);
  });
});
