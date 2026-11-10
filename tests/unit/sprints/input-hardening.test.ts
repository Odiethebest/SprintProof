import { expect, it } from "vitest";
import { createSprintSchema, validateSprint } from "@/lib/sprints";
import { createTeamSchema } from "@/lib/teams/create-team";
import { createApiTokenSchema } from "@/lib/api-tokens/api-token";
import { createStandupSchema } from "@/lib/standups/standup-input";
import { joinTeamSchema } from "@/lib/invites/invite-link";
import { toSafeCallbackPath } from "@/lib/auth/sign-in-redirect";
import {
  createSprintInput,
  createTeamInput,
  createStandupInput,
} from "../../factories/validation-inputs";

it.each(["0000", "0026", "1999", "2101"])(
  "rejects year %s with date field errors",
  (year) => {
    const errors = validateSprint({
      sprint: createSprintInput({
        startDate: `${year}-01-01`,
        endDate: `${year}-01-02`,
      }),
      existingSprints: [],
    });
    expect(errors.map((error) => error.field)).toEqual(
      expect.arrayContaining(["startDate", "endDate"])
    );
  }
);
it.each(["2000", "2100"])("accepts boundary year %s", (year) => {
  expect(
    validateSprint({
      sprint: createSprintInput({
        startDate: `${year}-01-01`,
        endDate: `${year}-01-02`,
      }),
      existingSprints: [],
    })
  ).toEqual([]);
});
it("trims sprint names and caps them at the team name limit", () => {
  expect(
    createSprintSchema.parse(createSprintInput({ name: "  Sprint 1  " })).name
  ).toBe("Sprint 1");
  expect(
    createSprintSchema.safeParse(createSprintInput({ name: "a".repeat(101) }))
      .success
  ).toBe(false);
  expect(
    validateSprint({
      sprint: createSprintInput({ name: "a".repeat(101) }),
      existingSprints: [],
    })
  ).toEqual(
    expect.arrayContaining([expect.objectContaining({ field: "name" })])
  );
});
it.each([
  () => createTeamSchema.safeParse(createTeamInput({ name: "a\u0000b" })),
  () => createApiTokenSchema.safeParse({ name: "a\u0000b" }),
  () => createSprintSchema.safeParse(createSprintInput({ name: "a\u0000b" })),
  ...(["yesterday", "today", "blockers"] as const).map(
    (field) => () =>
      createStandupSchema.safeParse(createStandupInput({ [field]: "a\u0000b" }))
  ),
  () => joinTeamSchema.safeParse({ inviteToken: "a\u0000b" }),
])("rejects NUL before reaching PostgreSQL (%#)", (parse) =>
  expect(parse().success).toBe(false)
);
it.each(["/..//evil.com", "/.//evil.com"])(
  "sends resolved network path %s home",
  (callbackUrl) => {
    expect(toSafeCallbackPath({ callbackUrl })).toBe("/");
  }
);
