/**
 * Lets the app work offline after the first visit (PRD §17.2). Only in the real build: during development
 * a cached copy would hide your changes. If the browser can't or won't, the app works exactly the same online.
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // No offline copy, nothing else changes. Not worth bothering the person with.
    });
  });
}
