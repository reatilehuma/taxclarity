import { readFileSync } from "node:fs";
import type { FlagCode, NoteCode, SourceId, WarningCode } from "@taxclarity/tax-engine";
import type { PdfFormat, PdfText } from "../types.ts";

const itemsOf = <K extends string, V>(codes: readonly K[], make: (code: K) => V) => Object.fromEntries(codes.map((c) => [c, make(c)])) as Record<K, V>;
const WARNINGS: WarningCode[] = ["DEDUCTIONS_EXCEED_GROSS", "VARIABLE_PAY_HIGH", "PAYSLIP_UIF_ABOVE_MAX", "PAYSLIP_PAYE_ABOVE_GROSS"];
const NOTES: NoteCode[] = ["ESTIMATED_FROM_TAKE_HOME", "VARIABLE_PAY_BALANCE_METHOD", "UIF_ON_AVERAGED_VARIABLE_PAY", "MEDICAL_CREDIT_CLAIMED_ON_FILING", "PRIVATE_RA_CLAIMED_ON_FILING", "MEDICAL_6B_INCLUDES_EMPLOYER_CONTRIBUTIONS", "SECOND_EMPLOYER_PAYE_ESTIMATED", "PAYSLIP_UIF_ASSUMED"];
export const FLAGS: FlagCode[] = ["OTHER_INCOME_NOT_INCLUDED", "CAPITAL_GAINS_NOT_INCLUDED", "FOREIGN_INCOME_OR_RESIDENCY", "FRINGE_BENEFITS_NOT_MODELLED", "HOME_OFFICE_NOT_MODELLED", "SDL_COIDA_EMPLOYER_ONLY", "RETIREMENT_LUMP_SUMS_NOT_CALCULATED", "COMMISSION_EARNER_DEDUCTIONS", "DONATIONS_TAX_LARGE_GIFTS", "DONATION_RECEIPT_NEEDED", "MULTIPLE_EMPLOYERS", "BELOW_THRESHOLD_MAY_NOT_NEED_TO_FILE", "TRAVEL_LOGBOOK_REQUIRED", "DIVIDENDS_NOT_INCLUDED", "MEDICAL_6B_POSSIBLE"];

/** Wording for tests. The real English lives in the app's strings module and is passed in the same shape. */
export const TEXT: PdfText = {
  productName: "ClearTax SA",
  filenamePrefix: "cleartax-sa-summary",
  title: "South African Income Tax — Calculation Summary",
  subtitle: "Independent estimate — not a SARS assessment",
  detailsHeading: "Details",
  detailLabels: { taxYear: "Tax year", period: "Period", generated: "Date generated", basedOn: "Calculation based on", confidence: "Confidence" },
  basedOn: { GROSS: "Gross salary", TAKE_HOME: "Bank deposit (gross salary estimated)", PAYSLIP: "Payslip" },
  confidence: { ESTIMATE: "Estimate", PAYSLIP_ACCURATE: "Payslip-based calculation" },
  columns: { description: "Description", amount: "Rand", month: "A normal month", year: "Whole year" },
  income: {
    heading: "Income and taxable amounts",
    rows: {
      INCOME_GROSS: "Gross remuneration",
      INCOME_EXTRAS: "Bonus, overtime and commission",
      INCOME_TRAVEL: "Taxable travel allowance",
      INCOME_EMPLOYER: "Employer contributions (taxable fringe benefit)",
      INCOME_OTHER_JOB: "Income from a second employer",
      INCOME_INTEREST: "Taxable interest",
    },
    total: "Total income",
  },
  deductions: {
    heading: "Deductions",
    rows: { RETIREMENT_DEDUCTION: "Retirement fund contributions (section 11F)", DONATIONS_DEDUCTION: "Donations to approved charities (section 18A)" },
    total: "Total deductions",
    taxable: "Taxable income",
    notes: ["Taxable income is the total income in Table 1 less the total deductions.", "Payroll deductions that SARS does not allow as deductions, such as medical aid payments, are not in this table."],
  },
  tax: {
    heading: "Tax calculation",
    rows: {
      TAX_BEFORE_REBATES: "Tax before rebates",
      REBATE_PRIMARY: "Primary rebate",
      REBATE_SECONDARY: "Age rebate (65 and over)",
      REBATE_TERTIARY: "Age rebate (75 and over)",
      REBATE_UNUSED: "Rebates not needed",
      TAX_AFTER_REBATES: "Tax after rebates",
      CREDIT_6A: "Medical scheme fees credit (section 6A)",
      CREDIT_6B: "Additional medical expenses credit (section 6B)",
      TAX_FOR_YEAR: "Calculated annual income-tax liability",
      PAYE_MONTH: "Estimated PAYE, per month",
      PAYSLIP_PAYE_MONTH: "PAYE on your payslip, per month",
      UIF_MONTH: "UIF, per month",
      TAKE_HOME_MONTH: "Take-home pay, per month",
      TAKE_HOME_YEAR: "Take-home pay, per year",
    },
    unusedCredit: (amount) => `Part of the medical credit (${amount}) could not be used because it would take the tax below R0.`,
  },
  comparison: {
    heading: "Payslip comparison (a normal month)",
    rows: { PAYSLIP_PAYE: "PAYE on your payslip", CALC_PAYE: "PAYE from our calculation", PAYSLIP_UIF: "UIF on your payslip", CALC_UIF: "UIF from our calculation" },
    uifAssumed: "You did not enter UIF, so we assumed the calculated amount.",
    match: "These match, to within R1.",
    higher: (gap, pct) => `Your payslip PAYE is ${gap}${pct ? ` (${pct})` : ""} higher than our calculation.`,
    lower: (gap, pct) => `Your payslip PAYE is ${gap}${pct ? ` (${pct})` : ""} lower than our calculation.`,
    explainHeading: "What a difference can mean",
    explain: "A difference does not mean your employer made a mistake.",
  },
  reconciliation: {
    heading: "From salary to bank account",
    rows: { GROSS: "Gross salary", EXTRAS: "Bonus, overtime and commission", TRAVEL: "Travel allowance", RETIREMENT_OWN: "Retirement contributions (yours)", MEDICAL_OWN: "Medical aid (your share)", PAYE: "PAYE (income tax)", UIF: "UIF", TAKE_HOME: "Take-home pay" },
    debitHeading: "Paid by debit order, not off your payslip",
    debitRows: { MEDICAL_DEBIT_ORDER: "Medical aid (your share)", RA_DEBIT_ORDER: "Retirement annuity" },
    yearNote: "A normal month leaves out any bonus, overtime or commission. The whole-year column includes them, after their tax.",
  },
  warnings: { heading: "Please check", items: itemsOf(WARNINGS, (c) => `Warning text for ${c}.`) },
  assumptions: { heading: "How we got these numbers", items: itemsOf(NOTES, (c) => `Assumption text for ${c}.`) },
  flags: { heading: "What this does not include", items: itemsOf(FLAGS, (c) => ({ title: `Title for ${c}`, body: `Explanation for ${c}.` })), readMore: (t) => `Read more: ${t}` },
  disclaimer: {
    heading: "Disclaimer",
    paragraph:
      "This independent calculator provides an estimate based on the information entered and the selected tax year's rules. It is not issued by SARS, is not a Notice of Assessment, does not submit a tax return, and does not establish an amount payable or refundable. Your actual tax position may differ due to items outside this calculator's scope.",
  },
  footerRules: (version, checked) => `Rules ${version} · figures last checked ${checked}`,
  page: (page, pages) => `Page ${page} of ${pages}`,
};

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const NBSP = " ";
/** Same shape as the app's formatters: "R 30 000,00" and "1 March 2026". */
export const FORMAT: PdfFormat = {
  rand: (n) => {
    const [whole = "0", cents = "00"] = Math.abs(n).toFixed(2).split(".");
    return `${n < 0 ? "−" : ""}R${NBSP}${whole.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP)},${cents}`;
  },
  percent: (n) => `${Number.isInteger(n) ? n : n.toFixed(1).replace(".", ",")}%`,
  date: (iso) => {
    const [y, m, d] = iso.slice(0, 10).split("-");
    return `${Number(d)} ${MONTHS[Number(m) - 1]} ${y}`;
  },
};

/** Stand-in addresses: the real list lives in the app, and tests only need something to print. */
export const SOURCE = (id: SourceId) => ({ title: `Source ${id}`, url: `https://example.org/${id}` });

const font = (name: string) => new Uint8Array(readFileSync(new URL(`../../fonts/${name}`, import.meta.url)));
export const FONTS = { regular: font("InterTabular-400.ttf"), bold: font("InterTabular-700.ttf") };
