import type { z } from "zod";
import type { TeamAccess } from "@/lib/auth/team-access";

type DeniedAccess = Extract<TeamAccess, { isAllowed: false }>;

const ACCESS_MESSAGES: Record<DeniedAccess["code"], string> = {
  UNAUTHENTICATED: "Sign in to continue.",
  FORBIDDEN: "You don't have permission to do this on this team.",
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
