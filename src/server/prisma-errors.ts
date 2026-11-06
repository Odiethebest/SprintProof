import { Prisma } from "@/generated/prisma/client";

// P2002: a unique constraint rejected the write.
export function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}
