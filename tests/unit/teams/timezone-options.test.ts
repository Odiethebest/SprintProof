import { expect, it } from "vitest";
import { getTimezoneOptions } from "@/lib/teams/timezone-options";
import { createTeamSchema } from "@/lib/teams/create-team";
it("includes UTC and replaces legacy IANA aliases without duplicates", () => {
  expect(
    getTimezoneOptions({
      timezones: [
        "Asia/Calcutta",
        "Europe/Kiev",
        "America/Godthab",
        "Asia/Kolkata",
      ],
    })
  ).toEqual(["America/Nuuk", "Asia/Kolkata", "Europe/Kyiv", "UTC"]);
});
it.each(["Asia/Calcutta", "Europe/Kiev", "America/Godthab", "UTC"])(
  "keeps stored legacy timezone %s valid",
  (timezone) => {
    expect(
      createTeamSchema.safeParse({
        name: "Team",
        repoFullName: "owner/repo",
        timezone,
      }).success
    ).toBe(true);
  }
);
