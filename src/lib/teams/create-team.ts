import { noNul } from "@/lib/validation/text";
import { z } from "zod";
import { GITHUB_LOGIN_PATTERN } from "@/lib/github/login";

export const DEFAULT_TEAM_TIMEZONE = "America/Los_Angeles";

export const MAX_TEAM_NAME_LENGTH = 100;
// GitHub repo names: up to 100 letters, digits, ".", "_" and "-".
const REPO_NAME_PATTERN = /^[A-Za-z0-9._-]{1,100}$/;
// GitHub reserves these two names for the current and parent directory.
const RESERVED_REPO_NAMES = new Set([".", ".."]);

const NAME_REQUIRED = "Add a team name.";
const NAME_TOO_LONG = `Use ${MAX_TEAM_NAME_LENGTH} characters or fewer.`;
const REPO_FORMAT =
  "Use the owner/name format, for example Odiethebest/SprintProof.";
const TIMEZONE_UNKNOWN = "Pick a timezone from the list.";

function isRepoFullName(value: string): boolean {
  const parts = value.split("/");
  if (parts.length !== 2) {
    return false;
  }
  const [owner, name] = parts;
  return (
    GITHUB_LOGIN_PATTERN.test(owner) &&
    REPO_NAME_PATTERN.test(name) &&
    !RESERVED_REPO_NAMES.has(name)
  );
}

// The same IANA database the sprint and standup date math uses.
function isKnownTimeZone(timeZone: string): boolean {
  if (timeZone === "") {
    return false;
  }
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

// Shared by POST /api/v1/teams and the create-team form, so both show the same errors.
export const createTeamSchema = z.object({
  name: z
    .string({ error: NAME_REQUIRED })
    .trim()
    .min(1, NAME_REQUIRED)
    .max(MAX_TEAM_NAME_LENGTH, NAME_TOO_LONG)
    .check(noNul),
  repoFullName: z
    .string({ error: REPO_FORMAT })
    .trim()
    .refine(isRepoFullName, REPO_FORMAT)
    .check(noNul),
  timezone: z
    .string({ error: TIMEZONE_UNKNOWN })
    .refine(isKnownTimeZone, TIMEZONE_UNKNOWN)
    .check(noNul)
    .default(DEFAULT_TEAM_TIMEZONE),
});

export type CreateTeamInput = z.output<typeof createTeamSchema>;
