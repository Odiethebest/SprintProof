import { z } from "zod";
import { createInviteSchema } from "@/lib/invites/invite-link";
import {
  accessDeniedResponse,
  catchUnexpectedErrors,
  parseInput,
  parseJsonBody,
} from "@/server/api-response";
import { requireTeamRole } from "@/server/auth";
import { createInvite } from "@/server/repositories/invites";

const paramsSchema = z.object({ teamId: z.string().min(1) });

interface Context {
  params: Promise<{ teamId: string }>;
}

// Creates a member or instructor invite link. Lead only.
export async function POST(request: Request, context: Context) {
  return catchUnexpectedErrors({
    route: "POST /api/v1/teams/{teamId}/invites",
    handler: () => handlePost(request, context),
  });
}

async function handlePost(request: Request, { params }: Context) {
  const parsedParams = parseInput({
    input: await params,
    schema: paramsSchema,
  });
  if (!parsedParams.isValid) {
    return parsedParams.response;
  }
  const { teamId } = parsedParams.data;
  const access = await requireTeamRole(teamId, ["LEAD"]);
  if (!access.isAllowed) {
    return accessDeniedResponse(access);
  }
  const parsed = await parseJsonBody({ request, schema: createInviteSchema });
  if (!parsed.isValid) {
    return parsed.response;
  }
  const invite = await createInvite({
    teamId,
    role: parsed.data.role,
    now: new Date(),
  });
  return Response.json(invite, { status: 201 });
}
