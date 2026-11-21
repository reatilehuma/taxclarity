import type { CalculationMode, Confidence, FlagCode, NoteCode, WarningCode } from "@taxclarity/tax-engine";

/**
 * The PDF summary as data (PRD §14.8): what goes on the page, already worded and formatted, with no layout in it.
 * Building it is pure and testable without a PDF; drawing it is `render.ts`. Everything in it comes from one
 * calculation result: nothing here is worked out again.
 */

/** Rows of Table 1 that the engine's income block can contain. */
export type IncomeRowId =
  | "INCOME_GROSS"
  | "INCOME_EXTRAS"
  | "INCOME_TRAVEL"
  | "INCOME_EMPLOYER"
  | "INCOME_OTHER_JOB"
  | "INCOME_INTEREST";

export type DeductionRowId = "RETIREMENT_DEDUCTION" | "DONATIONS_DEDUCTION";

/** Rows of Table 3: the tax working from the engine, then the payroll figures that follow from it. */
export type TaxRowId =
  | "TAX_BEFORE_REBATES"
  | "REBATE_PRIMARY"
  | "REBATE_SECONDARY"
  | "REBATE_TERTIARY"
  | "REBATE_UNUSED"
  | "TAX_AFTER_REBATES"
  | "CREDIT_6A"
  | "CREDIT_6B"
  | "TAX_FOR_YEAR"
  | "PAYE_MONTH"
  | "PAYSLIP_PAYE_MONTH"
  | "UIF_MONTH"
  | "TAKE_HOME_MONTH"
  | "TAKE_HOME_YEAR";

export type ComparisonRowId = "PAYSLIP_PAYE" | "CALC_PAYE" | "PAYSLIP_UIF" | "CALC_UIF";

/** The "pay to your bank account" block: gross to take-home, for a normal month and for the year. */
export type ReconciliationRowId = "GROSS" | "EXTRAS" | "TRAVEL" | "RETIREMENT_OWN" | "MEDICAL_OWN" | "PAYE" | "UIF" | "TAKE_HOME";
export type DebitOrderRowId = "MEDICAL_DEBIT_ORDER" | "RA_DEBIT_ORDER";

/** How amounts and dates are written. The app passes its own formatters, so the PDF reads exactly like the screen. */
export interface PdfFormat {
  /** 30000 → "R 30 000,00" */
  rand: (amount: number) => string;
  /** "2026-03-01" → "1 March 2026" */
  date: (iso: string) => string;
  /** 12.5 → "12,5%" (a number of percentage points). */
  percent: (points: number) => string;
}

/** Every word on the page. The app holds the English in its strings module and passes it in (D9). */
export interface PdfText {
  productName: string;
  /** Start of the file name, e.g. "cleartax-sa-summary". */
  filenamePrefix: string;
  title: string;
  subtitle: string;
  detailsHeading: string;
  detailLabels: { taxYear: string; period: string; generated: string; basedOn: string; confidence: string };
  basedOn: Record<CalculationMode, string>;
  confidence: Record<Confidence, string>;
  /** Column headings: the description, the rand column, and the two columns of the reconciliation. */
  columns: { description: string; amount: string; month: string; year: string };
  income: {
    heading: string;
    rows: Record<IncomeRowId, string>;
    total: string;
  };
  deductions: {
    heading: string;
    rows: Record<DeductionRowId, string>;
    total: string;
    taxable: string;
    /** Says how the table joins Table 1, and what is not a deduction. */
    notes: string[];
  };
  tax: {
    heading: string;
    rows: Record<TaxRowId, string>;
    /** "R 1 200,00 of your medical aid credit could not be used…" */
    unusedCredit: (amount: string) => string;
  };
  comparison: {
    heading: string;
    rows: Record<ComparisonRowId, string>;
    uifAssumed: string;
    match: string;
    higher: (gap: string, pct: string | null) => string;
    lower: (gap: string, pct: string | null) => string;
    explainHeading: string;
    explain: string;
  };
  reconciliation: {
    heading: string;
    rows: Record<ReconciliationRowId, string>;
    debitHeading: string;
    debitRows: Record<DebitOrderRowId, string>;
    /** Printed when there is bonus, overtime or commission: what "a normal month" leaves out. */
    yearNote: string;
  };
  warnings: { heading: string; items: Record<WarningCode, string> };
  assumptions: { heading: string; items: Record<NoteCode, string> };
  flags: { heading: string; items: Record<FlagCode, { title: string; body: string }>; readMore: (sourceTitle: string) => string };
  disclaimer: { heading: string; paragraph: string };
  /** "Rules 2026-27-r1 · figures last checked 18 November 2026" */
  footerRules: (rulesVersion: string, lastChecked: string) => string;
  /** "Page 1 of 2" */
  page: (page: number, pages: number) => string;
}

export interface SummaryRow {
  id: string;
  label: string;
  /** The rand column, written as on screen, e.g. "R 30 000,00" (with "−" or "+" where the row comes off or is added). */
  amount: string;
  /** The engine's number behind it, so tests can check the page against the calculation. Always positive: the sign is in `amount`. */
  value: number;
  /** The "a normal month" column, only in tables that have one. `null` where a single month makes no sense. */
  month?: { amount: string; value: number } | null;
  /** "total": shaded. "highlight": the line the table is about. "subtotal": a running total. */
  emphasis?: "total" | "highlight" | "subtotal";
}

export type TableId = "income" | "deductions" | "tax" | "comparison" | "reconciliation" | "debitOrder";

export interface SummaryTable {
  id: TableId;
  heading: string;
  /** `month` is present only in the tables that show a normal month beside the whole year. */
  columns: { description: string; month?: string; amount: string };
  rows: SummaryRow[];
  /** Small print under the table. */
  notes: string[];
}

/** Text the person should read, one item each: what to check, what is assumed, what is left out. */
export interface NoticeList {
  id: "warnings" | "assumptions" | "flags";
  heading: string;
  items: { title?: string; body: string; source?: string }[];
}

export interface SummaryDocument {
  productName: string;
  title: string;
  subtitle: string;
  details: { heading: string; rows: { label: string; value: string }[] };
  /** Table 1 first, then the others in the order they are printed. */
  tables: SummaryTable[];
  /** The sentence that says how the payslip compares with the calculation, and why it can differ. */
  comparisonVerdict: { verdict: string; explainHeading: string; explain: string } | null;
  notices: NoticeList[];
  disclaimer: { heading: string; paragraph: string };
  footer: { rules: string; page: (page: number, pages: number) => string };
  /** What goes in the file's own metadata: a title and the app name, nothing about the person. */
  meta: { title: string; creator: string };
}
