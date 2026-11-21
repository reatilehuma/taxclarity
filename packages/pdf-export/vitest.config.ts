import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    testTimeout: 30_000,
    coverage: { provider: "v8", include: ["src/**/*.ts"], exclude: ["src/__tests__/**", "src/index.ts"], reporter: ["text-summary", "text"] },
  },
});
