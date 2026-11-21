import { copy } from "../content/strings.ts";

const t = copy.wizard.progress;

/**
 * Where you are in the questions. A bar on larger screens and dots on phones (PRD §8).
 * Step 0 ("how do you want to start?") isn't counted, so "Step 4 of 8" matches the step numbers.
 * The label is announced politely whenever it changes (PRD §17.3).
 */
export function WizardProgress({ index, total, title }: { index: number; total: number; title: string }) {
  const label = index === 0 ? t.gettingStarted : t.stepOf(index, total, title);
  const percent = total === 0 ? 0 : (index / total) * 100;

  return (
    <div>
      <p aria-live="polite" className="text-sm font-semibold text-ink-700">
        {label}
      </p>

      {/* Larger screens: a bar. */}
      <div
        role="progressbar"
        aria-label={t.label}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={index}
        aria-valuetext={label}
        className="mt-2.5 hidden h-2 overflow-hidden rounded-full bg-ink-200 sm:block"
      >
        <div className="h-full rounded-full bg-brand-600 transition-[width] duration-300" style={{ width: `${percent}%` }} />
      </div>

      {/* Phones: dots. The label above already says the same in words. */}
      <ol aria-hidden="true" className="mt-2.5 flex items-center gap-2 sm:hidden">
        {Array.from({ length: total }, (_, i) => (
          <li key={i} className={`h-2.5 flex-1 rounded-full ${i < index ? "bg-brand-600" : "bg-ink-200"}`} />
        ))}
      </ol>
    </div>
  );
}
