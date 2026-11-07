import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  ...(process.env.DATABASE_URL
    ? {
        datasource: {
          url: process.env.DATABASE_URL,
          ...(process.env.SHADOW_DATABASE_URL
            ? { shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL }
            : {}),
        },
      }
    : {}),
});
