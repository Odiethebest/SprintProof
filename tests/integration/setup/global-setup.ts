import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import dotenv from "dotenv";

export default async function globalSetup(): Promise<void> {
  const envTestPath = path.resolve(process.cwd(), ".env.test");
  if (fs.existsSync(envTestPath)) {
    dotenv.config({ path: envTestPath, override: true });
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is not set. Integration tests require a running PostgreSQL database.",
    );
  }

  try {
    execSync("npx prisma migrate deploy", {
      stdio: "pipe",
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
      },
    });
  } catch (error) {
    console.error("Failed to run prisma migrate deploy:", error);
    throw error;
  }
}
