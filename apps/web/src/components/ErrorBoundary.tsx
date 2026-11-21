import { Component, type ReactNode } from "react";
import { copy } from "../content/strings.ts";
import { Container } from "./ui.tsx";

/**
 * If a page fails to load (a lost connection on the first visit, or a file removed by a newer release),
 * show a plain message and a way back instead of a blank screen. The calculator's own answers are not affected.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override render() {
    if (!this.state.failed) return this.props.children;
    const t = copy.loadError;
    return (
      <Container className="py-16 sm:py-24">
        <div role="alert" className="mx-auto max-w-lg rounded-[var(--radius-card)] bg-surface p-8 text-center ring-1 ring-ink-200/70">
          <h1 className="text-2xl font-bold tracking-tight text-ink-950">{t.title}</h1>
          <p className="mt-3 text-ink-600">{t.body}</p>
          <button
            type="button"
            onClick={() => window.location.assign("/")}
            className="mt-8 inline-flex min-h-11 items-center justify-center rounded-xl bg-brand-700 px-5 py-3 text-[15px] font-semibold text-white hover:bg-brand-800"
          >
            {t.reload}
          </button>
        </div>
      </Container>
    );
  }
}
