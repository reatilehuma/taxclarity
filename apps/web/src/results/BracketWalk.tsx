import type { BracketWalkRow } from "@taxclarity/tax-engine";
import { copy } from "../content/strings.ts";
import { bracketRange } from "../lib/brackets.ts";
import { formatPercent, formatRand } from "../lib/format.ts";

const t = copy.results.walk;

/** The 2026/27 SARS table with the person's income in each bracket: a direct rendering of the engine's `bracketWalk`. */
export function BracketWalk({ rows, caption }: { rows: BracketWalkRow[]; caption: string }) {
  return (
    <div
      role="region"
      aria-label={caption}
      // A scrollable box must be reachable by keyboard so its hidden columns can be scrolled into view.
      // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex
      tabIndex={0}
      className="overflow-x-auto rounded-2xl bg-surface ring-1 ring-ink-200 focus-visible:outline-2 focus-visible:outline-brand-600"
    >
      <table className="w-full min-w-[580px] text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="bg-ink-50 text-xs text-ink-500">
            <th scope="col" className="px-4 py-2.5 text-left font-medium">{t.cols.range}</th>
            <th scope="col" className="px-3 py-2.5 text-right font-medium">{t.cols.rate}</th>
            <th scope="col" className="px-3 py-2.5 text-right font-medium">{t.cols.yours}</th>
            <th scope="col" className="px-3 py-2.5 text-right font-medium">{t.cols.tax}</th>
            <th scope="col" className="px-4 py-2.5 text-right font-medium">{t.cols.running}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((b) => {
            const used = b.amountInBracket > 0;
            return (
              <tr
                key={b.index}
                className={`border-t border-ink-100 ${b.isTopBracket && used ? "bg-brand-50 font-semibold text-ink-950" : used ? "text-ink-800" : "text-ink-400"}`}
              >
                <th scope="row" className="money px-4 py-2.5 text-left font-[inherit]">
                  <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className={b.isTopBracket && used ? "" : "font-normal"}>{bracketRange(b)}</span>
                    {b.isTopBracket && used && (
                      <span className="rounded-full bg-brand-700 px-2 py-0.5 font-sans text-[11px] font-semibold text-white">{t.topBracket}</span>
                    )}
                  </span>
                </th>
                <td className="money px-3 py-2.5 text-right">{formatPercent(b.rate)}</td>
                <td className="money px-3 py-2.5 text-right whitespace-nowrap">{formatRand(b.amountInBracket)}</td>
                <td className="money px-3 py-2.5 text-right whitespace-nowrap">{formatRand(b.taxInBracket)}</td>
                <td className="money px-4 py-2.5 text-right whitespace-nowrap">{formatRand(b.runningTotal)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
