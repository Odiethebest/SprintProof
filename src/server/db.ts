import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { buildDatabasePoolConfig } from "@/lib/database/pool-config";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pool: Pool | undefined;
};

const pool =
  globalForPrisma.pool ??
  new Pool(
    // With DATABASE_CA_CERT set, the server certificate is verified against
    // it (decision 002); without it, pg follows PGSSLMODE as before.
    buildDatabasePoolConfig({
      connectionString: process.env.DATABASE_URL,
      caCertificate: process.env.DATABASE_CA_CERT,
    })
  );

const adapter = new PrismaPg(pool);

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
  globalForPrisma.pool = pool;
}
