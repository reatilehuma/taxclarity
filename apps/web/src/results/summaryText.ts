import type { CalculationResult } from "@taxclarity/tax-engine";
import { copy, PRODUCT_NAME, yearCopy, yearFactsOf } from "../content/strings.ts";
import { formatDate, formatRand } from "../lib/format.ts";

const t = copy.results;

/** The headline sentence as plain text, for the page and for the clipboard. */
export function headlineText(r: CalculationResult): string {
  return r.comparison
    ? `${t.payslipLead} ${formatRand(r.comparison.payslipPaye)}${yearCopy(yearFactsOf(r)).payslipMid} ${formatRand(r.comparison.calcPaye)}.`
    : `${t.payeLead} ${formatRand(r.monthlyPaye)}${t.takeHomeLead} ${formatRand(r.takeHomeMonthly)}.`;
}

/**
 * What "Copy summary" puts on the clipboard (PRD §14.8): the headline, a few key numbers and the
 * estimate label. Plain text, started by the person, never sent anywhere.
 */
export function summaryText(r: CalculationResult): string {
  // The year, its label and its dates come from the result itself, so the copied text always matches the numbers.
  const year = yearCopy(yearFactsOf(r));
  return [
    t.copy.title(PRODUCT_NAME, year.label),
    year.taxYearLine(formatDate(r.provenance.period.start), formatDate(r.provenance.period.end)),
    "",
    headlineText(r),
    t.copy.grossLine(formatRand(r.grossMonthly)),
    t.copy.annualLine(formatRand(r.annualLiability)),
    "",
    t.copy.footer,
  ].join("\n");
}
