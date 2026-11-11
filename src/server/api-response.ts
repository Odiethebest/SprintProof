import { unstable_rethrow } from "next/navigation";
import type { z } from "zod";
import type { ApiTeamAccess } from "@/lib/auth/team-access";
import { paginationQuerySchema } from "@/lib/api/pagination";
import { describeDatabaseError } from "@/server/prisma-errors";

type DeniedAccess = Extract<ApiTeamAccess, { isAllowed: false }>;

const ACCESS_MESSAGES: Record<DeniedAccess["code"], string> = {
  UNAUTHENTICATED: "Sign in to continue.",
  FORBIDDEN: "You don't have permission to do this on this team.",
  INVALID_TOKEN: "This API token isn't valid. Create a new one in Settings.",
};

// Every API error has this one shape (AGENTS.md §1 Key patterns).
export function errorResponse({
  status,
  code,
  message,
}: {
  status: number;
  code: string;
  message: string;
}): Response {
  return Response.json({ error: { code, message } }, { status });
}

// Wraps every /api/v1 handler, so an error nothing expected (a database outage,
// a bug) still answers in the one error shape, with nothing about the failure
// in it. The log names the route and the error's code or name only: never its
// message or the request body, which can quote standup text, feedback or
// tokens (AGENTS.md §4 Security requirements).
export async function catchUnexpectedErrors({
  route,
  handler,
}: {
  route: string;
  handler: () => Promise<Response>;
}): Promise<Response> {
  try {
    return await handler();
  } catch (error) {
    // Next.js throws to redirect or to stop a prerender; it handles those itself.
    unstable_rethrow(error);
    console.error(
      `Unexpected error in ${route}:`,
      describeDatabaseError(error)
    );
    return errorResponse({
      status: 500,
      code: "INTERNAL_ERROR",
      message: "Something went wrong on our side. Try again in a moment.",
    });
  }
}

export function accessDeniedResponse(access: DeniedAccess): Response {
  return errorResponse({
    status: access.status,
    code: access.code,
    message: ACCESS_MESSAGES[access.code],
  });
}

export function unauthenticatedResponse(): Response {
  return accessDeniedResponse({
    isAllowed: false,
    status: 401,
    code: "UNAUTHENTICATED",
  });
}

export type ParsedInput<Schema extends z.ZodType> =
  | { isValid: true; data: z.output<Schema> }
  | { isValid: false; response: Response };

function validationError(message: string): Response {
  return errorResponse({ status: 400, code: "VALIDATION_ERROR", message });
}

export function parseInput<Schema extends z.ZodType>({
  input,
  schema,
}: {
  input: unknown;
  schema: Schema;
}): ParsedInput<Schema> {
  const result = schema.safeParse(input);
  if (!result.success) {
    const message = result.error.issues[0]?.message ?? "Check the request.";
    return { isValid: false, response: validationError(message) };
  }
  return { isValid: true, data: result.data };
}

export async function parseJsonBody<Schema extends z.ZodType>({
  request,
  schema,
}: {
  request: Request;
  schema: Schema;
}): Promise<ParsedInput<Schema>> {
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return {
      isValid: false,
      response: validationError("Send the request body as JSON."),
    };
  }
  return parseInput({ input, schema });
}

// ?limit= and ?cursor= for list endpoints (AGENTS.md §1 API response shape).
export function parsePaginationQuery({
  request,
}: {
  request: Request;
}): ParsedInput<typeof paginationQuerySchema> {
  const { searchParams } = new URL(request.url);
  return parseInput({
    input: Object.fromEntries(searchParams),
    schema: paginationQuerySchema,
  });
}

export function invalidCursorResponse(): Response {
  return errorResponse({
    status: 400,
    code: "INVALID_CURSOR",
    message:
      "This cursor isn't from this list. Use the nextCursor from the previous page.",
  });
}

export function sprintNotFoundResponse(): Response {
  return errorResponse({
    status: 404,
    code: "SPRINT_NOT_FOUND",
    message: "Sprint not found.",
  });
}
