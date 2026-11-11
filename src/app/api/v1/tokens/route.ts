import { createApiTokenSchema } from "@/lib/api-tokens/api-token-name";
import {
  catchUnexpectedErrors,
  parseJsonBody,
  unauthenticatedResponse,
} from "@/server/api-response";
import { createPersonalApiToken } from "@/server/api-tokens";
import { getSessionUserId } from "@/server/auth-session";

// Creates a personal API token for the signed-in user. The response is the
// only time the token is shown. Session only: a token can't create tokens.
export async function POST(request: Request) {
  return catchUnexpectedErrors({
    route: "POST /api/v1/tokens",
    handler: () => handlePost(request),
  });
}

async function handlePost(request: Request) {
  const userId = await getSessionUserId();
  if (userId === null) {
    return unauthenticatedResponse();
  }
  const parsed = await parseJsonBody({ request, schema: createApiTokenSchema });
  if (!parsed.isValid) {
    return parsed.response;
  }
  const { apiToken, token } = await createPersonalApiToken({
    userId,
    name: parsed.data.name,
  });
  return Response.json({ ...apiToken, token }, { status: 201 });
}
