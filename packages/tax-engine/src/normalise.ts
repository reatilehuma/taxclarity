import { type Decimal, ZERO, minD, sanitiseAmount } from "./money.ts";
import type {
  AgeBand,
  CalculationInputs,
  CalculationMode,
  FundType,
  MedicalPaidBy,
  MedicalPaidVia,
  PayFrequency,
} from "./types.ts";

/** Pay periods in a year. Calendar facts, not tax parameters (PRD §8 Step 1). */
export const PERIODS_PER_YEAR: Record<PayFrequency, number> = {
  MONTHLY: 12,
  FORTNIGHTLY: 26,
  WEEKLY: 52,
};

const AGE_BANDS: readonly AgeBand[] = ["UNDER_65", "AGE_65_74", "AGE_75_PLUS"];
const MODES: readonly CalculationMode[] = ["GROSS", "TAKE_HOME", "PAYSLIP"];
const FUND_TYPES: readonly FundType[] = ["PENSION", "PROVIDENT", "RA"];
const PAID_BY: readonly MedicalPaidBy[] = ["SELF", "EMPLOYER", "SHARED"];
const PAID_VIA: readonly MedicalPaidVia[] = ["PAYROLL", "DEBIT_ORDER"];

export const MAX_MEDICAL_MEMBERS = 15;

/** Inputs after cleaning: every amount is a non-negative Decimal, every enum valid. */
export interface NormalisedInputs {
  mode: CalculationMode;
  ageBand: AgeBand;
  payFrequency: PayFrequency;
  periodsPerYear: number;
  /** Gross or take-home per pay period, depending on mode. */
  amountPerPeriod: Decimal;
  retirement: {
    ownMonthly: Decimal;
    employerMonthly: Decimal;
    privateRaMonthly: Decimal;
    fundTypes: FundType[];
  };
  medical: {
    member: boolean;
    members: number;
    monthsCovered: number;
    ownMonthly: Decimal;
    employerMonthly: Decimal;
    ownPaidVia: MedicalPaidVia;
    /** False only when the whole contribution is paid privately by debit order. */
    payrollAppliesCredit: boolean;
    /** Null when not given — Section 6B is then not worked out. */
    outOfPocketAnnual: Decimal | null;
    disabilityInFamily: boolean;
  };
  variable: {
    bonusAnnual: Decimal;
    overtimeAnnual: Decimal;
    commissionAnnual: Decimal;
    totalAnnual: Decimal;
  };
  advanced: {
    donationsAnnual: Decimal;
    has18AReceipt: boolean;
    localInterestAnnual: Decimal;
    travelAllowanceMonthly: Decimal;
    travelBusinessUse: number;
    travelBusinessKmAnnual: Decimal;
    hasSecondEmployer: boolean;
    secondEmployerAnnual: Decimal;
  };
  payslip: {
    payeMonthly: Decimal | null;
    uifMonthly: Decimal | null;
  };
}

function clampInt(value: number | undefined, min: number, max: number, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function clampShare(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** An optional amount: null when missing or not a number; negatives become R0. */
function optionalAmount(value: number | undefined): Decimal | null {
  if (value === undefined || Number.isNaN(value)) return null;
  return sanitiseAmount(value);
}

/**
 * Turns raw inputs into safe values (PRD §17.6: never throw on user input).
 * Negative or non-numeric amounts become R0; counts and shares are clamped.
 */
export function normalise(inputs: CalculationInputs): NormalisedInputs {
  const mode = inputs.mode && MODES.includes(inputs.mode) ? inputs.mode : "GROSS";
  const ageBand = AGE_BANDS.includes(inputs.ageBand) ? inputs.ageBand : "UNDER_65";
  const payFrequency =
    inputs.payFrequency && Object.hasOwn(PERIODS_PER_YEAR, inputs.payFrequency) ? inputs.payFrequency : "MONTHLY";

  const r = inputs.retirement;
  const retirement = {
    ownMonthly: sanitiseAmount(r?.ownMonthly ?? 0),
    employerMonthly: sanitiseAmount(r?.employerMonthly ?? 0),
    privateRaMonthly: sanitiseAmount(r?.privateRaMonthly ?? 0),
    fundTypes: [...new Set(r?.fundTypes ?? [])].filter((t) => FUND_TYPES.includes(t)),
  };

  const m = inputs.medical;
  const member = m?.member === true;
  const total = member ? sanitiseAmount(m.monthlyContribution) : ZERO;
  const paidBy = m && PAID_BY.includes(m.paidBy) ? m.paidBy : "SELF";
  let employerMedical: Decimal = ZERO;
  if (paidBy === "EMPLOYER") employerMedical = total;
  if (paidBy === "SHARED") employerMedical = minD(sanitiseAmount(m?.employerMonthly ?? 0), total);
  const ownMedical = total.minus(employerMedical);
  const ownPaidVia: MedicalPaidVia =
    m?.ownSharePaidVia && PAID_VIA.includes(m.ownSharePaidVia) && ownMedical.greaterThan(0)
      ? m.ownSharePaidVia
      : "PAYROLL";

  const v = inputs.variablePay;
  const bonusAnnual = sanitiseAmount(v?.bonusAnnual ?? 0);
  const overtimeAnnual = sanitiseAmount(v?.overtimeAnnual ?? 0);
  const commissionAnnual = sanitiseAmount(v?.commissionAnnual ?? 0);

  const a = inputs.advanced;
  const p = inputs.payslip;
  const periodsPerYear = PERIODS_PER_YEAR[payFrequency];
  // One payslip → a monthly figure: per period × periods in a year ÷ 12 months.
  const monthlyFromPeriod = (v: number | undefined) => {
    const amount = optionalAmount(v);
    return amount === null ? null : amount.times(periodsPerYear).dividedBy(12);
  };

  return {
    mode,
    ageBand,
    payFrequency,
    periodsPerYear,
    amountPerPeriod: sanitiseAmount(inputs.amount),
    retirement,
    medical: {
      member,
      members: member ? clampInt(m.members, 1, MAX_MEDICAL_MEMBERS, 1) : 0,
      monthsCovered: member ? clampInt(m.monthsCovered, 0, 12, 12) : 0,
      ownMonthly: ownMedical,
      employerMonthly: employerMedical,
      ownPaidVia,
      // If the employer pays any part, the scheme runs through payroll and the credit is applied there.
      payrollAppliesCredit: !(ownPaidVia === "DEBIT_ORDER" && employerMedical.isZero()),
      outOfPocketAnnual: optionalAmount(m?.outOfPocketAnnual),
      disabilityInFamily: m?.disabilityInFamily === true,
    },
    variable: {
      bonusAnnual,
      overtimeAnnual,
      commissionAnnual,
      totalAnnual: bonusAnnual.plus(overtimeAnnual).plus(commissionAnnual),
    },
    advanced: {
      donationsAnnual: sanitiseAmount(a?.donations18AAnnual ?? 0),
      has18AReceipt: a?.has18AReceipt === true,
      localInterestAnnual: sanitiseAmount(a?.localInterestAnnual ?? 0),
      travelAllowanceMonthly: sanitiseAmount(a?.travelAllowanceMonthly ?? 0),
      travelBusinessUse: clampShare(a?.travelBusinessUse),
      travelBusinessKmAnnual: sanitiseAmount(a?.travelBusinessKmAnnual ?? 0),
      hasSecondEmployer: a?.hasSecondEmployer === true || (a?.secondEmployerAnnualGross ?? 0) > 0,
      secondEmployerAnnual: sanitiseAmount(a?.secondEmployerAnnualGross ?? 0),
    },
    payslip: {
      payeMonthly: optionalAmount(p?.payeMonthly) ?? monthlyFromPeriod(p?.payePerPeriod),
      uifMonthly: optionalAmount(p?.uifMonthly) ?? monthlyFromPeriod(p?.uifPerPeriod),
    },
  };
}
