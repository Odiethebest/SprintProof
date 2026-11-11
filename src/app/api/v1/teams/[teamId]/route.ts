import { z } from "zod";
import {
  accessDeniedResponse,
  catchUnexpectedErrors,
  parseInput,
} from "@/server/api-response";
import { requireApiTeamRole } from "@/server/auth";
import { listTeamMembers } from "@/server/repositories/memberships";
import { findTeam } from "@/server/repositories/teams";

const paramsSchema = z.object({ teamId: z.string().min(1) });

interface Context {
  params: Promise<{ teamId: string }>;
}

// GET: One team and its members, leads first. Any member can read it, with a
// session or an API token (#97). Someone who isn't on the team gets 403, the
// same as for a team that doesn't exist, so ids reveal nothing.
export async function GET(request: Request, context: Context) {
  return catchUnexpectedErrors({
    route: "GET /api/v1/teams/{teamId}",
    handler: () => handleGet(request, context),
  });
}

async function handleGet(request: Request, { params }: Context) {
  const parsedParams = parseInput({
    input: await params,
    schema: paramsSchema,
  });
  if (!parsedParams.isValid) {
    return parsedParams.response;
  }
  const { teamId } = parsedParams.data;
  const access = await requireApiTeamRole(request, teamId, [
    "LEAD",
    "MEMBER",
    "INSTRUCTOR",
  ]);
  if (!access.isAllowed) {
    return accessDeniedResponse(access);
  }

  const [team, memberships] = await Promise.all([
    findTeam({ teamId }),
    listTeamMembers({ teamId }),
  ]);
  if (team === null) {
    // Unreachable: a membership can't outlive its team. This narrows the type.
    throw new Error("Team access passed without a team");
  }
  return Response.json({
    ...team,
    members: memberships.map(({ role, user }) => ({
      userId: user.id,
      name: user.name,
      githubLogin: user.githubLogin,
      role,
    })),
  });
}
