import type { PayslipComparison as Comparison } from "@taxclarity/tax-engine";
import { copy } from "../content/strings.ts";
import { formatPercentPoints, formatRand } from "../lib/format.ts";

const t = copy.results.comparison;

/** Payslip PAYE against ours (PRD §14.4). Only shown when payslip figures were entered; the tone is neutral on purpose. */
export function PayslipComparison({ comparison: c }: { comparison: Comparison }) {
  const gap = formatRand(Math.abs(c.diff));
  const pct = c.diffPct === null ? null : formatPercentPoints(Math.abs(c.diffPct));
  const verdict = c.closeMatch ? t.match : c.diff > 0 ? t.higher(gap, pct) : t.lower(gap, pct);

  return (
    <div className="rounded-2xl bg-surface p-4 ring-1 ring-ink-200 sm:p-5">
      <dl className="grid gap-4 sm:grid-cols-2">
        <Figure label={t.payslip} value={formatRand(c.payslipPaye)} />
        <Figure label={t.calc} value={formatRand(c.calcPaye)} />
      </dl>
      <p className="mt-4 rounded-xl bg-ink-50 px-4 py-3 text-[15px] font-semibold text-ink-900">
        <span className="sr-only">{t.difference}: </span>
        {verdict}
      </p>

      <dl className="mt-4 grid gap-4 border-t border-ink-100 pt-4 sm:grid-cols-2">
        <Figure label={t.uifPayslip} value={formatRand(c.payslipUif)} small />
        <Figure label={t.uifCalc} value={formatRand(c.calcUif)} small />
      </dl>
      {c.uifAssumed && <p className="mt-2 text-xs text-ink-500">{t.uifAssumed}</p>}

      <div className="mt-5 rounded-xl bg-brand-50 px-4 py-3">
        <h3 className="text-sm font-bold text-brand-900">{t.explainHeading}</h3>
        <p className="mt-1 text-sm leading-relaxed text-brand-900">{t.explain}</p>
      </div>
    </div>
  );
}

function Figure({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div>
      <dt className="text-xs font-medium text-ink-500">{label}</dt>
      <dd className={`money mt-0.5 font-semibold text-ink-950 ${small ? "text-base" : "text-2xl"}`}>{value}</dd>
    </div>
  );
}
