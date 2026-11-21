import type { CalculationResult } from "@taxclarity/tax-engine";
import { copy, ruleCopy, yearCopy, yearFactsOf } from "../content/strings.ts";
import { rulesFor } from "../lib/years.ts";
import { bracketRange } from "../lib/brackets.ts";
import { formatPercent, formatRand } from "../lib/format.ts";
import { Icon } from "./Icon.tsx";
import { InfoTip } from "./InfoTip.tsx";
import { ConfidenceBadge } from "./ui.tsx";

/**
 * The tax dashboard (PRD §12.2): badge, headline numbers, summary list, bracket bar and
 * the full SARS bracket table. Used as a fixed example on the landing page now, and as the
 * live preview panel in Phase 9. It only displays engine output — no tax maths here.
 */

const BRACKET_COLOURS = [
  "bg-bracket-1",
  "bg-bracket-2",
  "bg-bracket-3",
  "bg-bracket-4",
  "bg-bracket-5",
  "bg-bracket-6",
  "bg-bracket-7",
];

export interface PanelBadge {
  kind: "estimate" | "accurate" | "example";
  label: string;
}

export function TaxSummaryPanel({
  result: r,
  badges,
  caption,
  className = "",
}: {
  result: CalculationResult;
  badges: PanelBadge[];
  caption?: string;
  className?: string;
}) {
  const t = copy.panel;
  // Tooltips that quote a rule figure (the UIF maximum) come from the result's own year.
  const hints: Partial<Record<keyof typeof t.rows, string>> = { uif: ruleCopy(rulesFor(r.taxYear)).uifHint };
  const rows: { key: keyof typeof t.rows; monthly: number | null; annual: number; show: boolean }[] = [
    { key: "gross", monthly: r.grossMonthly, annual: r.grossAnnual, show: true },
    { key: "taxable", monthly: null, annual: r.taxableIncome, show: true },
    { key: "uif", monthly: r.uifMonthly, annual: r.uifAnnual, show: true },
    {
      key: "retirement",
      monthly: r.retirement.deductionMonthly,
      annual: r.retirement.deductionAnnual,
      show: r.retirement.deductionAnnual > 0,
    },
    { key: "medical", monthly: r.medical6A.monthlyCredit, annual: r.medical6A.annualCredit, show: r.medical6A.annualCredit > 0 },
    {
      key: "other",
      monthly: r.ownMedicalMonthly,
      annual: r.ownMedicalAnnual,
      show: r.ownMedicalAnnual > 0 && r.ownMedicalPaidVia === "PAYROLL",
    },
  ];

  return (
    <div className={`rounded-[var(--radius-card)] bg-surface p-4 shadow-[var(--shadow-float)] ring-1 ring-ink-200/70 sm:p-6 ${className}`}>
      <div className="flex flex-wrap items-center gap-2">
        {badges.map((b) => (
          <ConfidenceBadge key={b.label} kind={b.kind} label={b.label} />
        ))}
      </div>

      {/* Headline numbers */}
      <dl className="mt-5">
        <div>
          <dt className="text-sm font-medium text-ink-600">
            {t.takeHome} <span className="text-ink-400">· {copy.common.perMonth}</span>
          </dt>
          <dd className="money mt-1 text-4xl font-semibold tracking-tight text-brand-800 sm:text-[2.6rem]">
            {formatRand(r.takeHomeMonthly)}
          </dd>
        </div>
      </dl>
      <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-ink-100 pt-4">
        <div>
          <dt className="text-xs font-medium text-ink-500">
            {t.paye} · {copy.common.perMonth}
          </dt>
          <dd className="money mt-0.5 text-xl font-semibold text-ink-900">{formatRand(r.monthlyPaye)}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-ink-500">{t.annualTax}</dt>
          <dd className="money mt-0.5 text-base font-semibold text-ink-700">{formatRand(r.annualLiability)}</dd>
        </div>
      </dl>

      {/* Summary list */}
      <h3 className="sr-only">{t.summaryHeading}</h3>
      <table className="mt-5 w-full text-sm">
        <thead>
          <tr className="text-xs text-ink-500">
            <th scope="col" className="pb-1.5 text-left font-medium">
              <span className="sr-only">{t.summaryHeading}</span>
            </th>
            <th scope="col" className="pb-1.5 text-right font-medium">
              {copy.common.monthly}
            </th>
            <th scope="col" className="pb-1.5 pl-3 text-right font-medium">
              {copy.common.annual}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows
            .filter((row) => row.show)
            .map((row) => (
              <SummaryRow key={row.key} label={t.rows[row.key].label} hint={hints[row.key] ?? t.rows[row.key].hint} monthly={row.monthly} annual={row.annual} />
            ))}
        </tbody>
      </table>

      <BracketBar result={r} />
      <BracketTable result={r} />

      {caption && <p className="mt-4 text-xs text-ink-500">{caption}</p>}
    </div>
  );
}

function SummaryRow({ label, hint, monthly, annual }: { label: string; hint: string; monthly: number | null; annual: number }) {
  return (
    <tr className="border-t border-ink-100">
      <th scope="row" className="py-2 text-left font-normal text-ink-700">
        <span className="inline-flex items-center gap-1.5">
          {label}
          <InfoTip label={label} hint={hint} />
        </span>
      </th>
      <td className="money py-2 text-right text-ink-900">{monthly === null ? <span className="text-ink-300">—</span> : formatRand(monthly)}</td>
      <td className="money py-2 pl-3 text-right text-ink-600">{formatRand(annual)}</td>
    </tr>
  );
}

/** Stacked bar: how much income falls in each bracket, top bracket marked (PRD §12.2.4). */
function BracketBar({ result: r }: { result: CalculationResult }) {
  const t = copy.panel;
  const used = r.bracketWalk.filter((b) => b.amountInBracket > 0);
  const top = r.bracketWalk.find((b) => b.isTopBracket);
  if (used.length === 0 || r.taxableIncome <= 0) return null;

  return (
    <div className="mt-6">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold text-ink-900">{t.bracketHeading}</h3>
        {top && <span className="text-xs font-semibold text-brand-700">{t.topBracket(formatPercent(top.rate))}</span>}
      </div>
      <p className="mt-1 text-xs text-ink-500">{t.bracketHint}</p>
      {/* Visual bar; the same figures are in the table below for screen readers (PRD §17.3). */}
      <div aria-hidden="true" className="mt-3 flex h-3.5 gap-0.5 overflow-hidden rounded-full bg-ink-100">
        {used.map((b) => (
          <span
            key={b.index}
            title={t.bracketSegment(formatRand(b.amountInBracket, { decimals: 0 }), formatPercent(b.rate))}
            className={`${BRACKET_COLOURS[b.index]} ${b.isTopBracket ? "ring-2 ring-brand-950 ring-inset" : ""}`}
            style={{ width: `${(b.amountInBracket / r.taxableIncome) * 100}%` }}
          />
        ))}
      </div>
      <ul aria-hidden="true" className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-600">
        {used.map((b) => (
          <li key={b.index} className="inline-flex items-center gap-1">
            <span className={`h-2 w-2 rounded-sm ${BRACKET_COLOURS[b.index]}`} />
            <span className="money">{formatPercent(b.rate)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The full SARS table for the result's own year, with the user's row marked (PRD §12.2.5). */
function BracketTable({ result: r }: { result: CalculationResult }) {
  const t = copy.panel;
  const tableCaption = yearCopy(yearFactsOf(r)).panelTableCaption;
  return (
    <details className="group mt-5 rounded-xl border border-ink-200 bg-ink-50/60 open:bg-surface">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-ink-800 [&::-webkit-details-marker]:hidden">
        {t.tableToggle}
        <Icon name="chevronDown" className="h-4 w-4 text-ink-500 transition-transform group-open:rotate-180" />
      </summary>
      {/* A scrollable box must be reachable by keyboard so its hidden columns can be scrolled into view. */}
      {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
      <div role="region" aria-label={tableCaption} tabIndex={0} className="overflow-x-auto rounded-lg px-2 pb-3 focus-visible:outline-2 focus-visible:outline-brand-600">
        <table className="w-full min-w-[420px] text-xs">
          <caption className="sr-only">{tableCaption}</caption>
          <thead>
            <tr className="text-ink-500">
              <th scope="col" className="px-2 py-2 text-left font-medium">
                {t.tableCols.range}
              </th>
              <th scope="col" className="px-2 py-2 text-right font-medium">
                {t.tableCols.rate}
              </th>
              <th scope="col" className="px-2 py-2 text-right font-medium">
                {t.tableCols.yours}
              </th>
              <th scope="col" className="px-2 py-2 text-right font-medium">
                {t.tableCols.tax}
              </th>
            </tr>
          </thead>
          <tbody>
            {r.bracketWalk.map((b) => (
              <tr
                key={b.index}
                className={`border-t border-ink-100 ${b.isTopBracket ? "bg-brand-50 font-semibold text-ink-950" : b.amountInBracket > 0 ? "text-ink-800" : "text-ink-400"}`}
              >
                <th scope="row" className="money px-2 py-2 text-left font-normal">
                  <span className="inline-flex flex-wrap items-center gap-1.5">
                    {bracketRange(b)}
                    {b.isTopBracket && (
                      <span className="rounded-full bg-brand-700 px-1.5 py-0.5 font-sans text-[10px] font-semibold text-white">
                        {t.youAreHere}
                      </span>
                    )}
                  </span>
                </th>
                <td className="money px-2 py-2 text-right">{formatPercent(b.rate)}</td>
                <td className="money px-2 py-2 text-right">{formatRand(b.amountInBracket)}</td>
                <td className="money px-2 py-2 text-right">{formatRand(b.taxInBracket)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
