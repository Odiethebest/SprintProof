import { z } from "zod";
import { getCurrentSprint } from "@/lib/sprints";
import { getStandupDate } from "@/lib/standups/standup-date";
import { createStandupSchema } from "@/lib/standups/standup-input";
import {
  accessDeniedResponse,
  errorResponse,
  parseInput,
  parseJsonBody,
} from "@/server/api-response";
import { requireTeamRole } from "@/server/auth";
import { triggerTeamEvent } from "@/server/realtime";
import { listSprints } from "@/server/repositories/sprints";
import { saveStandup } from "@/server/repositories/standups";
import { findTeam } from "@/server/repositories/teams";

const paramsSchema = z.object({ teamId: z.string().min(1) });

// POST: Posts today's standup, or updates it if the user already posted today (rule R2).
// Leads and members only: instructors read standups but don't post them.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const parsedParams = parseInput({
    input: await params,
    schema: paramsSchema,
  });
  if (!parsedParams.isValid) {
    return parsedParams.response;
  }
  const { teamId } = parsedParams.data;
  const access = await requireTeamRole(teamId, ["LEAD", "MEMBER"]);
  if (!access.isAllowed) {
    return accessDeniedResponse(access);
  }
  const parsedBody = await parseJsonBody({
    request,
    schema: createStandupSchema,
  });
  if (!parsedBody.isValid) {
    return parsedBody.response;
  }

  const [team, sprints] = await Promise.all([
    findTeam({ teamId }),
    listSprints({ teamId }),
  ]);
  if (team === null) {
    return errorResponse({
      status: 404,
      code: "NOT_FOUND",
      message: "This team doesn't exist.",
    });
  }
  // The server picks the sprint and the date, so a standup can't be filed elsewhere.
  const now = new Date();
  const sprint = getCurrentSprint({ sprints, now, timeZone: team.timezone });
  if (sprint === null) {
    return errorResponse({
      status: 409,
      code: "NO_CURRENT_SPRINT",
      message: "Today isn't in any sprint. A lead can add one in Settings.",
    });
  }

  const { standup, isNew } = await saveStandup({
    sprint,
    userId: access.userId,
    date: getStandupDate({ now, timezone: team.timezone }),
    ...parsedBody.data,
  });
  await triggerTeamEvent({
    teamId,
    event: isNew ? "standup.created" : "standup.updated",
  });
  return Response.json(standup, { status: isNew ? 201 : 200 });
}
