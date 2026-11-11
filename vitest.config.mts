import { defineConfig, configDefaults } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    exclude: [
      ...configDefaults.exclude,
      "e2e/**",
      "docs/**",
      "tests/integration/**",
      "src/generated/**",
    ],
    include: ["tests/unit/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    // `--coverage` (CI) fails below these minimums for src/lib/, the code the
    // unit tests cover (AGENTS.md §1 Testing strategy).
    coverage: {
      provider: "v8",
      include: ["src/lib/**"],
      reporter: ["text", "text-summary", "json-summary"],
      thresholds: { lines: 90, statements: 90, functions: 90, branches: 85 },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
});
