import type {
  TaxYear,
  AgeBand,
  CalculationInputs,
  CalculationMode,
  FundType,
  MedicalPaidBy,
  MedicalPaidVia,
  PayFrequency,
} from "@taxclarity/tax-engine";

/** Workbench form state. Money fields are kept as typed text; empty optional fields mean "not given". */
export interface FormState {
  mode: CalculationMode;
  amount: string;
  payFrequency: PayFrequency;
  ageBand: AgeBand;
  hasRetirement: boolean;
  retirementOwn: string;
  retirementEmployer: string;
  privateRa: string;
  fundTypes: FundType[];
  hasMedical: boolean;
  members: number;
  medicalTotal: string;
  medicalPaidBy: MedicalPaidBy;
  medicalEmployer: string;
  medicalPaidVia: MedicalPaidVia;
  monthsCovered: number;
  outOfPocket: string;
  disability: boolean;
  hasVariable: boolean;
  bonus: string;
  overtime: string;
  commission: string;
  hasExtras: boolean;
  donations: string;
  hasReceipt: boolean;
  interest: string;
  travelAllowance: string;
  travelBusiness80: boolean;
  travelKm: string;
  hasSecondEmployer: boolean;
  secondEmployer: string;
  payslipPaye: string;
  payslipUif: string;
}

export const EMPTY: FormState = {
  mode: "GROSS",
  amount: "30000",
  payFrequency: "MONTHLY",
  ageBand: "UNDER_65",
  hasRetirement: false,
  retirementOwn: "0",
  retirementEmployer: "0",
  privateRa: "0",
  fundTypes: [],
  hasMedical: false,
  members: 1,
  medicalTotal: "0",
  medicalPaidBy: "SELF",
  medicalEmployer: "0",
  medicalPaidVia: "PAYROLL",
  monthsCovered: 12,
  outOfPocket: "",
  disability: false,
  hasVariable: false,
  bonus: "0",
  overtime: "0",
  commission: "0",
  hasExtras: false,
  donations: "0",
  hasReceipt: false,
  interest: "0",
  travelAllowance: "0",
  travelBusiness80: false,
  travelKm: "0",
  hasSecondEmployer: false,
  secondEmployer: "",
  payslipPaye: "",
  payslipUif: "",
};

export interface Scenario {
  id: string;
  label: string;
  /** The tax year the expected figures are for. Loading the preset switches to it. Defaults to 2026/27. */
  year?: TaxYear;
  /** What the engine should show — compare by eye. */
  expect: string;
  form: Partial<FormState>;
}

/** PRD §10.4 test vectors that can be entered as inputs, plus a few extra scenarios. */
export const TEST_VECTORS: Scenario[] = [
  {
    id: "T1",
    label: "T1 · R30 000, 10% pension, medical main + 1",
    expect: "PAYE R3 149,00 · take-home R23 673,88",
    form: { amount: "30000", hasRetirement: true, retirementOwn: "3000", fundTypes: ["PENSION"], hasMedical: true, members: 2 },
  },
  {
    id: "T2",
    label: "T2 · taxable exactly R245 100",
    expect: "Tax before rebates R44 118,00 · top of the 18% bracket",
    form: { amount: "20425" },
  },
  { id: "T4", label: "T4 · taxable R99 000 (under 65)", expect: "Tax before rebates R17 820,00 · PAYE R0,00", form: { amount: "8250" } },
  {
    id: "T6",
    label: "T6 · 75+, taxable R171 300",
    expect: "Tax before rebates R30 834,00 · rebates R30 834,00 · PAYE R0,00",
    form: { amount: "14275", ageBand: "AGE_75_PLUS" },
  },
  { id: "T7", label: "T7 · R17 713 (R1 above UIF ceiling)", expect: "UIF R177,12", form: { amount: "17713" } },
  { id: "T8", label: "T8 · R5 000", expect: "UIF R50,00 · PAYE R0,00 · below threshold", form: { amount: "5000" } },
  { id: "T9", label: "T9 · zero income", expect: "Everything R0,00, no errors", form: { amount: "0" } },
  {
    id: "T10",
    label: "T10 · R60 000, own RA R200 000/yr",
    expect: "Retirement deduction R198 000,00 · R2 000,00 carried forward",
    form: { amount: "60000", hasRetirement: true, retirementOwn: String(200_000 / 12), fundTypes: ["RA"] },
  },
  {
    id: "T11",
    label: "T11 · R150 000, R600 000/yr contributions",
    expect: "Limit R430 000,00 (cap) · R170 000,00 carried forward",
    form: { amount: "150000", hasRetirement: true, retirementOwn: "30000", retirementEmployer: "20000" },
  },
  {
    id: "T14",
    label: "T14 · 65+, contributions R40 000/yr, OOP R10 000",
    expect: "Section 6A R4 512,00 · Section 6B R12 142,51 (corrected, D2)",
    form: {
      amount: "30000",
      ageBand: "AGE_65_74",
      hasMedical: true,
      members: 1,
      medicalTotal: String(40_000 / 12),
      outOfPocket: "10000",
    },
  },
  {
    id: "T15",
    label: "T15 · donations R50 000 on R300 000",
    expect: "Donation deduction R30 000,00 · R20 000,00 carried forward",
    form: { amount: "25000", hasExtras: true, donations: "50000", hasReceipt: true },
  },
  {
    id: "T16",
    label: "T16 · R20 000 take-home",
    expect: "Estimated gross ≈ R23 051,51 (corrected, D1)",
    form: { mode: "TAKE_HOME", amount: "20000" },
  },
  {
    id: "T17",
    label: "T17 · payslip R45 000, PAYE R6 800",
    expect: "Calculated PAYE R9 275,58 · difference −R2 475,58 (−26,7%) · neutral wording",
    form: { mode: "PAYSLIP", amount: "45000", payslipPaye: "6800" },
  },
  {
    id: "T18",
    label: "T18 · interest R30 000 (under 65)",
    expect: "Taxable interest R6 200,00",
    form: { amount: "30000", hasExtras: true, interest: "30000" },
  },
  {
    id: "T19",
    label: "T19 · travel R5 000, under 80% business",
    expect: "Taxable allowance R4 000,00 a month",
    form: { amount: "30000", hasExtras: true, travelAllowance: "5000" },
  },
  {
    id: "T20",
    label: "T20 · travel R5 000, 80%+ business",
    expect: "Taxable allowance R1 000,00 a month",
    form: { amount: "30000", hasExtras: true, travelAllowance: "5000", travelBusiness80: true },
  },
];

export const SCENARIOS: Scenario[] = [
  {
    id: "bonus",
    label: "Bonus",
    expect: "Normal month R25 141,88 · averaged R26 963,13",
    form: { amount: "30000", hasVariable: true, bonus: "30000" },
  },
  {
    id: "medical-debit",
    label: "Medical by debit order",
    expect: "PAYE R3 901,00 · refund on filing R9 024,00",
    form: {
      amount: "30000",
      hasRetirement: true,
      retirementOwn: "3000",
      hasMedical: true,
      members: 2,
      medicalTotal: "4000",
      medicalPaidVia: "DEBIT_ORDER",
    },
  },
  {
    id: "ra-debit",
    label: "Private RA",
    expect: "PAYE unchanged R4 681,00 · refund on filing R6 240,00",
    form: { amount: "30000", hasRetirement: true, privateRa: "2000", fundTypes: ["RA"] },
  },
  {
    id: "two-jobs",
    label: "Two jobs",
    expect: "Final tax R86 017,00 · owed on filing ≈ R29 665,00",
    form: { amount: "30000", hasExtras: true, hasSecondEmployer: true, secondEmployer: "100000" },
  },
  {
    id: "employer-medical",
    label: "Employer medical",
    expect: "Taxable income +R24 000 · PAYE +R144 a month",
    form: { amount: "25000", hasMedical: true, members: 1, medicalTotal: "2000", medicalPaidBy: "EMPLOYER" },
  },
  { id: "weekly", label: "Weekly", expect: "Take-home R4 378,90 a week", form: { amount: "5000", payFrequency: "WEEKLY" } },
];

/** Vectors that can't be entered as inputs; they're covered by the engine tests. */

/**
 * 2025/26 reference vectors Y1–Y19 (draft year). Expected figures were worked out independently of the engine
 * from the published SARS formulas; the working is in docs/rulesets/2025-26-vectors.md.
 */
export const Y_VECTORS: Scenario[] = [
  {
    id: "Y1",
    year: "2025-26",
    label: "Y1 · R30 000, 10% pension, medical main + 1",
    expect: "PAYE R3 275,08 · take-home R23 547,80",
    form: { amount: "30000", hasRetirement: true, retirementOwn: "3000", fundTypes: ["PENSION"], hasMedical: true, members: 2 },
  },
  { id: "Y2", year: "2025-26", label: "Y2 · R19 750 (18% band)", expect: "Tax before rebates R42 660,00 · PAYE R2 118,75", form: { amount: "19750" } },
  { id: "Y3", year: "2025-26", label: "Y3 · R19 800 (R500 into 26%)", expect: "Tax before rebates R42 808,00 · PAYE R2 131,08", form: { amount: "19800" } },
  { id: "Y4", year: "2025-26", label: "Y4 · R7 900, under 65 threshold", expect: "Tax R0,00 · PAYE R0,00 · take-home R7 821,00", form: { amount: "7900" } },
  { id: "Y5", year: "2025-26", label: "Y5 · R8 000, just over it", expect: "PAYE R3,75 · take-home R7 916,25", form: { amount: "8000" } },
  { id: "Y6", year: "2025-26", label: "Y6 · 65–74, R12 300, under threshold", expect: "Tax R0,00 · take-home R12 177,00", form: { amount: "12300", ageBand: "AGE_65_74" } },
  { id: "Y7", year: "2025-26", label: "Y7 · 65–74, R12 400, just over", expect: "PAYE R8,75 · take-home R12 267,25", form: { amount: "12400", ageBand: "AGE_65_74" } },
  { id: "Y8", year: "2025-26", label: "Y8 · 75+, R13 700, under threshold", expect: "Tax R0,00 · take-home R13 563,00", form: { amount: "13700", ageBand: "AGE_75_PLUS" } },
  { id: "Y9", year: "2025-26", label: "Y9 · 75+, R13 900, just over", expect: "PAYE R16,67 · take-home R13 744,33", form: { amount: "13900", ageBand: "AGE_75_PLUS" } },
  { id: "Y10", year: "2025-26", label: "Y10 · R17 713 (R1 above UIF ceiling)", expect: "UIF R177,12 · PAYE R1 752,09 · take-home R15 783,79", form: { amount: "17713" } },
  { id: "Y11", year: "2025-26", label: "Y11 · zero income", expect: "Everything R0,00, no errors", form: { amount: "0" } },
  {
    id: "Y12",
    year: "2025-26",
    label: "Y12 · R150 000, R600 000/yr into retirement",
    expect: "Limit R350 000,00 (cap) · R250 000,00 carried forward",
    form: { amount: "150000", hasRetirement: true, retirementOwn: "30000", retirementEmployer: "20000" },
  },
  {
    id: "Y13",
    year: "2025-26",
    label: "Y13 · R120 000, R360 000/yr into retirement",
    expect: "Deduction R350 000,00 (cap) · R10 000,00 carried forward",
    form: { amount: "120000", hasRetirement: true, retirementOwn: "30000" },
  },
  { id: "Y14", year: "2025-26", label: "Y14 · R30 000, medical aid for 1", expect: "PAYE R4 419,08 · take-home R25 403,80", form: { amount: "30000", hasMedical: true, members: 1 } },
  { id: "Y15", year: "2025-26", label: "Y15 · R30 000, medical aid for 5", expect: "PAYE R3 317,08 · take-home R26 505,80", form: { amount: "30000", hasMedical: true, members: 5 } },
  {
    id: "Y17",
    year: "2025-26",
    label: "Y17 · R30 000 and R60 000 bonus",
    expect: "Normal month PAYE R4 783,08 · take-home R25 039,80 · year PAYE R75 472,00 · average take-home R28 533,55",
    form: { amount: "30000", hasVariable: true, bonus: "60000" },
  },
  {
    id: "Y18",
    year: "2025-26",
    label: "Y18 · R20 000 take-home",
    expect: "Estimated gross ≈ R23 189,47 (within R1)",
    form: { mode: "TAKE_HOME", amount: "20000" },
  },
  {
    id: "Y19",
    year: "2025-26",
    label: "Y19 · 65+, medical for 2 at R3 500, OOP R10 000",
    expect: "Section 6A R8 736,00 · Section 6B R8 588,74 · final tax R30 628,26",
    form: { amount: "30000", ageBand: "AGE_65_74", hasMedical: true, members: 2, medicalTotal: "3500", outOfPocket: "10000" },
  },
];

export const ENGINE_ONLY_VECTORS = "T3, T5, T12 and T13 are checked directly in the engine tests.";

/** Accepts "30000", "30 000", "R30 000", "30,000.00" and "30 000,50". */
export function parseAmount(raw: string): number {
  let text = raw.replace(/[R\s ]/gi, "");
  if (/^\d+,\d{1,2}$/.test(text)) text = text.replace(",", ".");
  else text = text.replace(/,/g, "");
  const value = Number(text);
  return text === "" || !Number.isFinite(value) ? Number.NaN : value;
}

export function amountError(raw: string, optional = false): string | null {
  if (raw.trim() === "") return optional ? null : "Enter an amount (R0 is fine).";
  const v = parseAmount(raw);
  if (Number.isNaN(v)) return "That doesn't look like an amount.";
  if (v < 0) return "Amounts can't be negative.";
  return null;
}

const amount = (raw: string) => (amountError(raw) ? 0 : parseAmount(raw));
/** Optional amount: undefined when blank or invalid. */
const optional = (raw: string) => (raw.trim() === "" || amountError(raw) ? undefined : parseAmount(raw));

/** Builds engine inputs, leaving out "not given" optional values (exactOptionalPropertyTypes). */
export function toInputs(f: FormState): CalculationInputs {
  const oop = f.hasMedical || f.disability ? optional(f.outOfPocket) : undefined;
  const second = optional(f.secondEmployer);
  const slipPaye = optional(f.payslipPaye);
  const slipUif = optional(f.payslipUif);

  return {
    mode: f.mode,
    amount: amount(f.amount),
    payFrequency: f.payFrequency,
    ageBand: f.ageBand,
    retirement: f.hasRetirement
      ? {
          ownMonthly: amount(f.retirementOwn),
          employerMonthly: amount(f.retirementEmployer),
          privateRaMonthly: amount(f.privateRa),
          fundTypes: f.fundTypes,
        }
      : { ownMonthly: 0, employerMonthly: 0 },
    medical: {
      member: f.hasMedical,
      members: f.members,
      monthlyContribution: amount(f.medicalTotal),
      paidBy: f.medicalPaidBy,
      employerMonthly: amount(f.medicalEmployer),
      monthsCovered: f.monthsCovered,
      ownSharePaidVia: f.medicalPaidVia,
      disabilityInFamily: f.disability,
      ...(oop === undefined ? {} : { outOfPocketAnnual: oop }),
    },
    variablePay: f.hasVariable
      ? { bonusAnnual: amount(f.bonus), overtimeAnnual: amount(f.overtime), commissionAnnual: amount(f.commission) }
      : {},
    advanced: f.hasExtras
      ? {
          donations18AAnnual: amount(f.donations),
          has18AReceipt: f.hasReceipt,
          localInterestAnnual: amount(f.interest),
          travelAllowanceMonthly: amount(f.travelAllowance),
          travelBusinessUse: f.travelBusiness80 ? 0.8 : 0,
          travelBusinessKmAnnual: amount(f.travelKm),
          hasSecondEmployer: f.hasSecondEmployer,
          ...(f.hasSecondEmployer && second !== undefined ? { secondEmployerAnnualGross: second } : {}),
        }
      : {},
    payslip: {
      ...(slipPaye === undefined ? {} : { payeMonthly: slipPaye }),
      ...(slipUif === undefined ? {} : { uifMonthly: slipUif }),
    },
  };
}
