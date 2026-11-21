import type { CalculationResult } from "@taxclarity/tax-engine";
import { Icon } from "../components/Icon.tsx";
import { copy } from "../content/strings.ts";
import { sourceFor } from "../lib/sources.ts";

const t = copy.results;

/** Engine warnings: things the person should double-check. Shown right under the headline. */
export function Warnings({ warnings }: { warnings: CalculationResult["warnings"] }) {
  if (warnings.length === 0) return null;
  return (
    <div className="mt-6 rounded-xl bg-alert-bg px-4 py-3 text-alert-fg">
      <h2 className="text-sm font-bold">{t.warningsHeading}</h2>
      <ul className="mt-1 space-y-1 text-sm">
        {warnings.map((w) => (
          <li key={w}>{t.warnings[w]}</li>
        ))}
      </ul>
    </div>
  );
}

/** Engine notes: the assumptions behind the numbers. */
export function Assumptions({ notes }: { notes: CalculationResult["notes"] }) {
  return (
    <ul className="space-y-2.5">
      {notes.map((n) => (
        <li key={n} className="flex gap-3 rounded-xl bg-surface px-4 py-3 text-[15px] text-ink-700 ring-1 ring-ink-200">
          <Icon name="info" className="mt-0.5 h-4.5 w-4.5 shrink-0 text-ink-400" />
          <span>{t.notes[n]}</span>
        </li>
      ))}
    </ul>
  );
}

/** Engine flags: what this calculator leaves out, each linking to its SARS source (PRD §14.7). */
export function Flags({ flags, taxYear }: { flags: CalculationResult["flags"]; taxYear: CalculationResult["taxYear"] }) {
  return (
    <ul className="space-y-2.5">
      {flags.map((f) => {
        const text = t.flags[f.code];
        const source = sourceFor(f.source, taxYear);
        return (
          <li key={f.code} className="flex gap-3 rounded-xl bg-surface px-4 py-3 ring-1 ring-ink-200">
            <Icon name="alert" className="mt-0.5 h-4.5 w-4.5 shrink-0 text-estimate-fg" />
            <div className="min-w-0">
              <p className="text-[15px] font-semibold text-ink-950">{text.title}</p>
              <p className="mt-0.5 text-sm text-ink-600">{text.body}</p>
              <a
                href={source.url}
                target="_blank"
                rel="noreferrer"
                className="mt-1.5 inline-flex items-center gap-1 text-sm font-medium text-brand-700 underline decoration-brand-300 underline-offset-4 hover:text-brand-900"
              >
                {t.flagLink(source.title)}
                <Icon name="arrowRight" className="h-3.5 w-3.5 -rotate-45" />
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
