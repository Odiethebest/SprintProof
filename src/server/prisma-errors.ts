import { Prisma } from "@/generated/prisma/client";

// P2002: a unique constraint rejected the write.
export function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

// A short label for logs: the Prisma error code (P2002, P2028...) or the error's
// name. Never the message, which can quote the values that were written.
export function describeDatabaseError(error: unknown): string {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code;
  }
  return error instanceof Error ? error.name : "unknown error";
}
