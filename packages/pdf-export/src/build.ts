import { buildBreakdown, type Breakdown, type BreakdownRow, type BreakdownRowId, type CalculationResult, type SourceId } from "@taxclarity/tax-engine";
import type { DebitOrderRowId, DeductionRowId, IncomeRowId, NoticeList, PdfFormat, PdfText, ReconciliationRowId, SummaryDocument, SummaryRow, SummaryTable, TaxRowId } from "./types.ts";

const MINUS = "−";

/** The engine's row kinds, as the sign in front of the amount (the results page does the same). */
function signed(kind: BreakdownRow["kind"], text: string, first: boolean): string {
  if (kind === "less") return `${MINUS} ${text}`;
  if (kind === "add" && !first) return `+ ${text}`;
  return text;
}

/** The engine's income rows, in the order the results page shows them. */
const INCOME_IDS: readonly IncomeRowId[] = ["INCOME_GROSS", "INCOME_EXTRAS", "INCOME_TRAVEL", "INCOME_EMPLOYER", "INCOME_OTHER_JOB", "INCOME_INTEREST"];
const isIncomeRow = (id: BreakdownRowId): id is IncomeRowId => (INCOME_IDS as readonly string[]).includes(id);
const DEDUCTION_IDS: readonly DeductionRowId[] = ["RETIREMENT_DEDUCTION", "DONATIONS_DEDUCTION"];
const isDeductionRow = (id: BreakdownRowId): id is DeductionRowId => (DEDUCTION_IDS as readonly string[]).includes(id);
const RECONCILIATION_IDS: readonly ReconciliationRowId[] = ["GROSS", "EXTRAS", "TRAVEL", "RETIREMENT_OWN", "MEDICAL_OWN", "PAYE", "UIF", "TAKE_HOME"];
const TAX_IDS: readonly TaxRowId[] = ["TAX_BEFORE_REBATES", "REBATE_PRIMARY", "REBATE_SECONDARY", "REBATE_TERTIARY", "REBATE_UNUSED", "TAX_AFTER_REBATES", "CREDIT_6A", "CREDIT_6B", "TAX_FOR_YEAR"];

type Context = { result: CalculationResult; text: PdfText; format: PdfFormat; breakdown: Breakdown };

const money = (c: Context, id: string, label: string, value: number, emphasis?: SummaryRow["emphasis"], text?: string): SummaryRow => ({
  id,
  label,
  amount: text ?? c.format.rand(value),
  value,
  ...(emphasis ? { emphasis } : {}),
});

/**
 * Table 1, "Income and taxable amounts" (PRD §14.8): the income the engine counted, one row for each kind that applies,
 * and the engine's own total. A row appears only if the calculation has something in it. No figure is worked out here.
 */
function incomeTable(c: Context): SummaryTable {
  const { result, text } = c;
  const rows: SummaryRow[] = c.breakdown.tax
    .filter((r) => isIncomeRow(r.id))
    .map((r) => money(c, r.id, text.income.rows[r.id as IncomeRowId], r.annual));
  rows.push(money(c, "INCOME_TOTAL", text.income.total, result.incomeBeforeDeductions, "total"));
  return { id: "income", heading: text.income.heading, columns: { description: text.columns.description, amount: text.columns.amount }, rows, notes: [] };
}

/**
 * Table 2, "Deductions": what comes off the income before tax, then the taxable income the engine arrived at. The total
 * is the rows added in whole cents, and taxable income is the engine's own figure, so the table can be checked by hand.
 */
function deductionsTable(c: Context): SummaryTable {
  const { result, text } = c;
  const lines = c.breakdown.tax.filter((r) => isDeductionRow(r.id));
  const rows = lines.map((r) => money(c, r.id, text.deductions.rows[r.id as DeductionRowId], r.annual));
  const totalCents = lines.reduce((sum, r) => sum + Math.round(r.annual * 100), 0);
  rows.push(money(c, "DEDUCTIONS_TOTAL", text.deductions.total, totalCents / 100, "total"));
  rows.push(money(c, "TAXABLE_INCOME", text.deductions.taxable, result.taxableIncome, "highlight"));
  return { id: "deductions", heading: text.deductions.heading, columns: { description: text.columns.description, amount: text.columns.amount }, rows, notes: text.deductions.notes };
}

/**
 * Table 3, "Tax calculation": from the tax on the taxable income to the year's tax, then the payroll figures that follow.
 * The year's tax is the highlighted line. It is a calculated liability, never a refund or an amount payable (D17).
 * Rows are annual; every monthly row says so in its label (D18).
 */
function taxTable(c: Context): SummaryTable {
  const { result, text } = c;
  const start = c.breakdown.tax.findIndex((r) => r.id === "TAX_BEFORE_REBATES");
  const working = c.breakdown.tax.slice(start).filter((r): r is BreakdownRow & { id: TaxRowId } => (TAX_IDS as readonly string[]).includes(r.id));
  const rows: SummaryRow[] = working.map((r, i) =>
    money(c, r.id, text.tax.rows[r.id], r.annual, r.id === "TAX_FOR_YEAR" ? "highlight" : r.kind === "subtotal" ? "subtotal" : undefined, signed(r.kind, c.format.rand(r.annual), i === 0)),
  );
  rows.push(money(c, "PAYE_MONTH", text.tax.rows.PAYE_MONTH, result.monthlyPaye));
  if (result.comparison) rows.push(money(c, "PAYSLIP_PAYE_MONTH", text.tax.rows.PAYSLIP_PAYE_MONTH, result.comparison.payslipPaye));
  rows.push(money(c, "UIF_MONTH", text.tax.rows.UIF_MONTH, result.uifMonthly));
  rows.push(money(c, "TAKE_HOME_MONTH", text.tax.rows.TAKE_HOME_MONTH, result.takeHomeMonthly, "total"));
  rows.push(money(c, "TAKE_HOME_YEAR", text.tax.rows.TAKE_HOME_YEAR, result.takeHomeAnnual, "total"));
  const notes = result.medical6A.unusedAnnual > 0 ? [text.tax.unusedCredit(c.format.rand(result.medical6A.unusedAnnual))] : [];
  return { id: "tax", heading: text.tax.heading, columns: { description: text.columns.description, amount: text.columns.amount }, rows, notes };
}

/** The payslip against our calculation (PRD §14.4), only when a payslip's PAYE was given. Both figures are for a normal month. */
function comparisonTable(c: Context): SummaryTable | null {
  const cmp = c.result.comparison;
  if (!cmp) return null;
  const { text } = c;
  const rows = [
    money(c, "PAYSLIP_PAYE", text.comparison.rows.PAYSLIP_PAYE, cmp.payslipPaye),
    money(c, "CALC_PAYE", text.comparison.rows.CALC_PAYE, cmp.calcPaye),
    money(c, "PAYSLIP_UIF", text.comparison.rows.PAYSLIP_UIF, cmp.payslipUif),
    money(c, "CALC_UIF", text.comparison.rows.CALC_UIF, cmp.calcUif),
  ];
  return { id: "comparison", heading: text.comparison.heading, columns: { description: text.columns.description, amount: text.columns.amount }, rows, notes: cmp.uifAssumed ? [text.comparison.uifAssumed] : [] };
}

function verdictFor(c: Context): SummaryDocument["comparisonVerdict"] {
  const cmp = c.result.comparison;
  if (!cmp) return null;
  const { text, format } = c;
  const gap = format.rand(Math.abs(cmp.diff));
  const pct = cmp.diffPct === null ? null : format.percent(Math.abs(cmp.diffPct));
  const verdict = cmp.closeMatch ? text.comparison.match : cmp.diff > 0 ? text.comparison.higher(gap, pct) : text.comparison.lower(gap, pct);
  return { verdict, explainHeading: text.comparison.explainHeading, explain: text.comparison.explain };
}

/** The "pay to your bank account" block, with a normal month beside the whole year (D19), and what is paid by debit order. */
function reconciliationTables(c: Context): SummaryTable[] {
  const { text, result } = c;
  const columns = { description: text.columns.description, month: text.columns.month, amount: text.columns.year };
  const line = (r: BreakdownRow, label: string, first: boolean): SummaryRow => ({
    id: r.id,
    label,
    amount: signed(r.kind, c.format.rand(r.annual), first),
    value: r.annual,
    month: r.monthly === null ? null : { amount: signed(r.kind, c.format.rand(r.monthly), first), value: r.monthly },
    ...(r.kind === "total" ? { emphasis: "highlight" as const } : {}),
  });
  const main = c.breakdown.payslip.filter((r) => (RECONCILIATION_IDS as readonly string[]).includes(r.id));
  const tables: SummaryTable[] = [
    {
      id: "reconciliation",
      heading: text.reconciliation.heading,
      columns,
      rows: main.map((r, i) => line(r, text.reconciliation.rows[r.id as ReconciliationRowId], i === 0)),
      notes: result.variablePay.totalAnnual > 0 ? [text.reconciliation.yearNote] : [],
    },
  ];
  if (c.breakdown.offPayslip.length > 0) {
    tables.push({
      id: "debitOrder",
      heading: text.reconciliation.debitHeading,
      columns,
      rows: c.breakdown.offPayslip.map((r) => line(r, text.reconciliation.debitRows[r.id as DebitOrderRowId], true)),
      notes: [],
    });
  }
  return tables;
}

function noticeLists(c: Context, source: SourceLookup): NoticeList[] {
  const { result, text } = c;
  const lists: NoticeList[] = [];
  if (result.warnings.length > 0) lists.push({ id: "warnings", heading: text.warnings.heading, items: result.warnings.map((w) => ({ body: text.warnings.items[w] })) });
  if (result.notes.length > 0) lists.push({ id: "assumptions", heading: text.assumptions.heading, items: result.notes.map((n) => ({ body: text.assumptions.items[n] })) });
  if (result.flags.length > 0) {
    lists.push({
      id: "flags",
      heading: text.flags.heading,
      items: result.flags.map((f) => {
        const src = source(f.source);
        return { title: text.flags.items[f.code].title, body: text.flags.items[f.code].body, source: `${text.flags.readMore(src.title)} · ${src.url}` };
      }),
    });
  }
  return lists;
}

/** Where a source id points for this result's tax year (the app owns the list of addresses). */
export type SourceLookup = (id: SourceId) => { title: string; url: string };

/**
 * The summary document for one calculation (PRD §14.8). `generatedOn` is an ISO date chosen by the caller (the day the
 * person pressed the button), so this stays pure. The year, its dates, the rules version and the date they were last
 * checked all come from the result itself, which is the same result the page shows.
 */
export function buildSummaryDocument(input: { result: CalculationResult; text: PdfText; format: PdfFormat; generatedOn: string; source: SourceLookup }): SummaryDocument {
  const { result: r, text, format, generatedOn } = input;
  const p = r.provenance;
  const label = r.taxYear.replace("-", "/");
  const c: Context = { result: r, text, format, breakdown: buildBreakdown(r) };
  const comparison = comparisonTable(c);
  return {
    productName: text.productName,
    title: text.title,
    subtitle: text.subtitle,
    details: {
      heading: text.detailsHeading,
      // No reference number, no ID, no name: nothing here identifies the person (PRD §14.8).
      rows: [
        { label: text.detailLabels.taxYear, value: label },
        { label: text.detailLabels.period, value: `${format.date(p.period.start)} – ${format.date(p.period.end)}` },
        { label: text.detailLabels.generated, value: format.date(generatedOn) },
        { label: text.detailLabels.basedOn, value: text.basedOn[r.mode] },
        { label: text.detailLabels.confidence, value: text.confidence[r.confidence] },
      ],
    },
    tables: [incomeTable(c), deductionsTable(c), taxTable(c), ...(comparison ? [comparison] : []), ...reconciliationTables(c)],
    comparisonVerdict: verdictFor(c),
    notices: noticeLists(c, input.source),
    disclaimer: text.disclaimer,
    footer: { rules: text.footerRules(p.rulesVersion, format.date(p.lastVerifiedAt)), page: text.page },
    meta: { title: text.title, creator: text.productName },
  };
}

/** "cleartax-sa-summary-2026-27-2026-11-20.pdf": the year chosen and the day it was made. */
export function summaryFileName(prefix: string, taxYear: string, generatedOn: string): string {
  return `${prefix}-${taxYear}-${generatedOn}.pdf`;
}
