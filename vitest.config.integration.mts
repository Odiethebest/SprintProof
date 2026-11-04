import { defineConfig } from "vitest/config";
import path from "path";
import fs from "node:fs";
import dotenv from "dotenv";

const envTestPath = path.resolve(import.meta.dirname, "./.env.test");
if (fs.existsSync(envTestPath)) {
  dotenv.config({ path: envTestPath, override: true });
}

export default defineConfig({
  test: {
    include: ["tests/integration/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    exclude: ["tests/integration/setup/**", "node_modules/**", "src/generated/**"],
    globalSetup: ["tests/integration/setup/global-setup.ts"],
    setupFiles: ["tests/integration/setup/test-setup.ts"],
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
});
