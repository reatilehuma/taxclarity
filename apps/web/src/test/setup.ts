// Shared test setup. jsdom has no matchMedia or scrolling; the app only reads them.
import { cleanup } from "@testing-library/react";
import { afterEach, beforeAll } from "vitest";

if (typeof window !== "undefined") {
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
  window.scrollTo = () => {};
  Element.prototype.scrollIntoView = () => {};
}

afterEach(cleanup);

// The wizard and results pages load on demand in the app. Tests load them up front so that they render at once.
beforeAll(async () => {
  const { preloadResults, preloadWizard } = await import("../lazyPages.ts");
  await Promise.all([preloadWizard(), preloadResults()]);
});
