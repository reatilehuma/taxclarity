import type { WizardAnswers } from "../answers.ts";

export interface StepViewProps {
  answers: WizardAnswers;
  update: (patch: Partial<WizardAnswers>) => void;
}

/**
 * The question at the top of each step. It is the page's one h1, and takes focus when the
 * step changes so keyboard and screen-reader users land on the new question.
 */
export function StepHeading({ children, sub }: { children: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <header className="mb-6">
      <h1 tabIndex={-1} className="text-[1.65rem] leading-tight font-bold tracking-tight text-ink-950 outline-none sm:text-3xl">
        {children}
      </h1>
      {sub && <p className="mt-2 text-base text-ink-600">{sub}</p>}
    </header>
  );
}

/** A calm note under a field: guidance, not an alarm. */
export function InlineNote({ tone = "info", children }: { tone?: "info" | "warn"; children: React.ReactNode }) {
  const cls = tone === "warn" ? "bg-alert-bg text-alert-fg" : "bg-brand-50 text-brand-900";
  return <p className={`mt-4 rounded-xl px-4 py-3 text-sm leading-snug ${cls}`}>{children}</p>;
}
