import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { beforeAll } from "vitest";
import { db } from "@/server/db";

const envTestPath = path.resolve(process.cwd(), ".env.test");
if (fs.existsSync(envTestPath)) {
  dotenv.config({ path: envTestPath, override: true });
}

export async function clearDatabase(): Promise<void> {
  if (!process.env.DATABASE_URL) return;

  await db.$executeRawUnsafe(`
    DO $$ DECLARE
      r RECORD;
    BEGIN
      FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename != '_prisma_migrations') LOOP
        EXECUTE 'TRUNCATE TABLE "' || r.tablename || '" CASCADE';
      END LOOP;
    END $$;
  `);
}

beforeAll(async () => {
  await clearDatabase();
});
