import { z } from "zod";
import { toWebhookSecretLast4 } from "@/lib/github/webhook-secret";
import {
  accessDeniedResponse,
  catchUnexpectedErrors,
  parseInput,
} from "@/server/api-response";
import { requireTeamRole } from "@/server/auth";
import { rotateTeamWebhookSecret } from "@/server/repositories/teams";

const paramsSchema = z.object({ teamId: z.string().min(1) });

interface Context {
  params: Promise<{ teamId: string }>;
}

// Rotates the team's webhook secret (decision 005, #115). Lead only, with a
// session: an API token can't change data. The response has only the last 4
// characters; the lead copies the full secret from Settings, and no API
// response ever contains it.
export async function POST(_request: Request, context: Context) {
  return catchUnexpectedErrors({
    route: "POST /api/v1/teams/{teamId}/webhook-secret",
    handler: () => handlePost(context),
  });
}

async function handlePost({ params }: Context) {
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
  const { webhookSecret } = await rotateTeamWebhookSecret({ teamId });
  return Response.json({ last4: toWebhookSecretLast4({ webhookSecret }) });
}
