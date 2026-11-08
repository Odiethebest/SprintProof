import { z } from "zod";
import {
  errorResponse,
  parseInput,
  unauthenticatedResponse,
} from "@/server/api-response";
import { getSessionUserId } from "@/server/auth-session";
import { deleteApiToken } from "@/server/repositories/api-tokens";

const paramsSchema = z.object({ tokenId: z.string().min(1) });

// Revokes one of the signed-in user's tokens. Someone else's token gets the
// same 404 as a missing one, so ids reveal nothing.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ tokenId: string }> }
) {
  const userId = await getSessionUserId();
  if (userId === null) {
    return unauthenticatedResponse();
  }
  const parsedParams = parseInput({
    input: await params,
    schema: paramsSchema,
  });
  if (!parsedParams.isValid) {
    return parsedParams.response;
  }
  const isDeleted = await deleteApiToken({
    userId,
    tokenId: parsedParams.data.tokenId,
  });
  if (!isDeleted) {
    return errorResponse({
      status: 404,
      code: "TOKEN_NOT_FOUND",
      message: "You have no API token with that id.",
    });
  }
  return new Response(null, { status: 204 });
}
