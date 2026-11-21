import { lazyPage } from "./lib/lazyPage.tsx";

/**
 * The wizard and the results page are separate downloads: someone who only reads the landing page never
 * pays for them, and the preload functions fetch them ahead of need (when a button that leads there is
 * touched, say). Both are kept by the service worker, so they also work offline.
 */
export const wizardPage = lazyPage(() => import("./wizard/WizardPage.tsx").then((m) => m.WizardPage));
export const resultsPage = lazyPage(() => import("./pages/Results.tsx").then((m) => m.ResultsPage));
export const preloadWizard = wizardPage.preload;
export const preloadResults = resultsPage.preload;
