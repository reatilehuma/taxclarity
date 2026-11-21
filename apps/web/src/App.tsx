import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router";
import { ErrorBoundary } from "./components/ErrorBoundary.tsx";
import { Layout } from "./components/Layout.tsx";
import { resultsPage, wizardPage } from "./lazyPages.ts";
import { Landing } from "./pages/Landing.tsx";
import { NotFound } from "./pages/NotFound.tsx";
import { WizardProvider } from "./wizard/WizardContext.tsx";

/**
 * Routes (PRD §18): `/` landing, `/wizard?step=N`, `/results`.
 * `/workbench` exists in development only; production builds leave it out entirely.
 *
 * The wizard and the results page load on demand (see lazyPages.ts).
 *
 * The wizard's answers live in <WizardProvider>, in memory: a page refresh mounts a new one,
 * which is how "refreshing restarts the wizard" works.
 */
const Workbench = import.meta.env.DEV
  ? lazy(() => import("./workbench/Workbench.tsx").then((m) => ({ default: m.Workbench })))
  : null;

const Loading = () => <p className="px-4 py-16 text-center text-ink-600">Loading…</p>;

export function AppRoutes() {
  return (
    <WizardProvider>
      <ErrorBoundary>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Landing />} />
            <Route
              path="wizard"
              element={
                <Suspense fallback={<Loading />}>
                  <wizardPage.Page />
                </Suspense>
              }
            />
            <Route
              path="results"
              element={
                <Suspense fallback={<Loading />}>
                  <resultsPage.Page />
                </Suspense>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Route>
          {Workbench && (
            <Route
              path="workbench"
              element={
                <Suspense fallback={null}>
                  <div className="min-h-screen bg-slate-50 text-slate-900">
                    <Workbench />
                  </div>
                </Suspense>
              }
            />
          )}
        </Routes>
      </ErrorBoundary>
    </WizardProvider>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
