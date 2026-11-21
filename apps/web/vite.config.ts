import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { serviceWorker } from "./vite/service-worker.ts";

export default defineConfig({
  plugins: [react(), tailwindcss(), serviceWorker()],
  // Keep every font and image a real file (never a data: address inside the CSS), so the strict content policy
  // can stay free of `data:` fonts and the offline list sees them.
  // The PDF library is one big chunk, but it is loaded only when someone presses "Download PDF summary" (npm run bundle:check
  // keeps it out of the landing page), so the usual "chunk over 500 kB" warning is raised to just above it.
  build: { assetsInlineLimit: 0, chunkSizeWarningLimit: 900 },
  test: {
    include: ["src/**/*.test.{ts,tsx}", "vite/**/*.test.ts"], // the browser tests in e2e/ run with Playwright, not here
    setupFiles: ["./src/test/setup.ts"],
    // Click-through tests walk the whole wizard, which can take several seconds on a busy machine.
    testTimeout: 30_000,
  },
});
