import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Property tests run thousands of calculations; coverage instrumentation slows them down.
    testTimeout: 30_000,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/__tests__/**", "src/index.ts", "src/types.ts"],
      reporter: ["text-summary", "text"],
      // PRD §20 Phase 1 acceptance: ≥ 90% line coverage on the engine.
      thresholds: { lines: 90, branches: 90, functions: 90, statements: 90 },
    },
  },
});
