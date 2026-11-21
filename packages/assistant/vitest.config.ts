import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    testTimeout: 30_000,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/__tests__/**", "src/index.ts", "src/types.ts"],
      reporter: ["text-summary", "text"],
      thresholds: { lines: 90, branches: 80, functions: 90, statements: 90 },
    },
  },
});
