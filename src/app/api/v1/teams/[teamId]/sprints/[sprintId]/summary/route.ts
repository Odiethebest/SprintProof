import { z } from "zod";
import { getSprintWindow } from "@/lib/sprints";
import { buildSprintSummary } from "@/lib/stats/sprint-summary";
import {
  accessDeniedResponse,
  parseInput,
  sprintNotFoundResponse,
} from "@/server/api-response";
import { requireApiTeamRole } from "@/server/auth";
import { listTeamActivities } from "@/server/repositories/activities";
import { listTeamMembers } from "@/server/repositories/memberships";
import { findSprintById } from "@/server/repositories/sprints";
import { listSprintStandups } from "@/server/repositories/standups";
import { findTeam } from "@/server/repositories/teams";

const paramsSchema = z.object({
  teamId: z.string().min(1),
  sprintId: z.string().min(1),
});

// GET: One sprint's counts per member: commits, opened PRs, standups and
// reviews with their requirement status. Any member can read it, with a
// session or an API token (#16). Peer feedback is never part of it (AGENTS.md §1).
export async function GET(
  request: Request,
  { params }: { params: Promise<{ teamId: string; sprintId: string }> }
) {
  const parsedParams = parseInput({
    input: await params,
    schema: paramsSchema,
  });
  if (!parsedParams.isValid) {
    return parsedParams.response;
  }
  const { teamId, sprintId } = parsedParams.data;
  const access = await requireApiTeamRole(request, teamId, [
    "LEAD",
    "MEMBER",
    "INSTRUCTOR",
  ]);
  if (!access.isAllowed) {
    return accessDeniedResponse(access);
  }

  const [team, sprint] = await Promise.all([
    findTeam({ teamId }),
    findSprintById({ teamId, sprintId }),
  ]);
  if (team === null || sprint === null) {
    return sprintNotFoundResponse();
  }
  const timeZone = team.timezone;
  const window = getSprintWindow({ sprint, timeZone });
  const [memberships, standups, activities] = await Promise.all([
    listTeamMembers({ teamId }),
    listSprintStandups({ sprintId }),
    listTeamActivities({ teamId, from: window.start, to: window.end }),
  ]);

  const summary = buildSprintSummary({
    sprint,
    timeZone,
    members: memberships.map(({ role, user }) => ({
      userId: user.id,
      name: user.name,
      githubLogin: user.githubLogin,
      role,
    })),
    standups: standups.map(({ id, userId, createdAt }) => ({
      id,
      userId,
      createdAt,
    })),
    activities,
    now: new Date(),
  });
  return Response.json(summary);
}
