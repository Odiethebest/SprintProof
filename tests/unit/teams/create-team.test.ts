import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  DEFAULT_TEAM_TIMEZONE,
  createTeamSchema,
} from "@/lib/teams/create-team";

function fieldErrors(input: unknown) {
  const result = createTeamSchema.safeParse(input);
  if (result.success) {
    throw new Error("Expected the input to be rejected");
  }
  return z.flattenError(result.error).fieldErrors;
}

const validInput = {
  name: "SprintProof",
  repoFullName: "Odiethebest/SprintProof",
  timezone: "America/New_York",
};

describe("createTeamSchema", () => {
  it("accepts a name, an owner/name repo and a timezone", () => {
    expect(createTeamSchema.parse(validInput)).toEqual(validInput);
  });

  it("defaults the timezone to America/Los_Angeles", () => {
    // Act
    const team = createTeamSchema.parse({
      name: "SprintProof",
      repoFullName: "Odiethebest/SprintProof",
    });

    // Assert
    expect(DEFAULT_TEAM_TIMEZONE).toBe("America/Los_Angeles");
    expect(team.timezone).toBe("America/Los_Angeles");
  });

  it("trims spaces around the name and the repo", () => {
    // Act
    const team = createTeamSchema.parse({
      ...validInput,
      name: "  SprintProof  ",
      repoFullName: " Odiethebest/SprintProof ",
    });

    // Assert
    expect(team.name).toBe("SprintProof");
    expect(team.repoFullName).toBe("Odiethebest/SprintProof");
  });

  describe("name", () => {
    it.each([
      ["missing", undefined],
      ["empty", ""],
      ["only spaces", "   "],
    ])("asks for a name when it is %s", (_label, name) => {
      expect(fieldErrors({ ...validInput, name }).name).toEqual([
        "Add a team name.",
      ]);
    });

    it("accepts 100 characters", () => {
      const name = "a".repeat(100);
      expect(createTeamSchema.parse({ ...validInput, name }).name).toBe(name);
    });

    it("rejects more than 100 characters", () => {
      expect(
        fieldErrors({ ...validInput, name: "a".repeat(101) }).name
      ).toEqual(["Use 100 characters or fewer."]);
    });
  });

  describe("repoFullName", () => {
    it.each([
      "a/b",
      "octo-org/my.repo_name-2",
      `${"a".repeat(39)}/${"b".repeat(100)}`,
    ])("accepts %s", (repoFullName) => {
      expect(
        createTeamSchema.parse({ ...validInput, repoFullName }).repoFullName
      ).toBe(repoFullName);
    });

    it.each([
      ["missing", undefined],
      ["no slash", "SprintProof"],
      ["no owner", "/SprintProof"],
      ["no repo name", "Odiethebest/"],
      ["a third segment", "Odiethebest/SprintProof/issues"],
      ["a GitHub URL", "https://github.com/Odiethebest/SprintProof"],
      ["an owner starting with a hyphen", "-odie/SprintProof"],
      ["an owner ending with a hyphen", "odie-/SprintProof"],
      ["two hyphens in a row in the owner", "odie--yang/SprintProof"],
      ["an owner longer than 39 characters", `${"a".repeat(40)}/repo`],
      ["a repo name longer than 100 characters", `owner/${"b".repeat(101)}`],
      ["a space in the repo name", "Odiethebest/Sprint Proof"],
      ["a repo named .", "Odiethebest/."],
      ["a repo named ..", "Odiethebest/.."],
    ])("rejects %s", (_label, repoFullName) => {
      expect(fieldErrors({ ...validInput, repoFullName }).repoFullName).toEqual(
        ["Use the owner/name format, for example Odiethebest/SprintProof."]
      );
    });
  });

  describe("timezone", () => {
    it.each(["America/Los_Angeles", "Asia/Shanghai", "Europe/London", "UTC"])(
      "accepts %s",
      (timezone) => {
        expect(
          createTeamSchema.parse({ ...validInput, timezone }).timezone
        ).toBe(timezone);
      }
    );

    it.each([
      ["an unknown zone", "Mars/Olympus"],
      ["plain text", "not a timezone"],
      ["an empty string", ""],
    ])("rejects %s", (_label, timezone) => {
      expect(fieldErrors({ ...validInput, timezone }).timezone).toEqual([
        "Pick a timezone from the list.",
      ]);
    });
  });
});
