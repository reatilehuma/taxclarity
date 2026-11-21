import type {
  AdvancedInputs,
  AgeBand,
  CalculationInputs,
  CalculationMode,
  MedicalInputs,
  MedicalPaidBy,
  MedicalPaidVia,
  PayFrequency,
  PayslipInputs,
  TaxYear,
} from "@taxclarity/tax-engine";
import { DEFAULT_TAX_YEAR } from "../lib/years.ts";

/**
 * What the person has told us so far. Lives in memory only (PRD §17.1): nothing is saved,
 * so refreshing the page starts again. Amounts are null until the person has typed one.
 */

export type VariableType = "BONUS" | "OVERTIME" | "COMMISSION";

export interface RetirementAnswers {
  /** Null until they answer yes or no. */
  has: boolean | null;
  /** Taken off the payslip each month (pension or provident fund). */
  payslipMonthly: number | null;
  /** Paid by the person from their bank account each month (a retirement annuity they set up). */
  raMonthly: number | null;
  employerContributes: boolean;
  employerMonthly: number | null;
}

export interface MedicalAnswers {
  /** Null until they answer yes or no. */
  member: boolean | null;
  /** People on the plan, including the main member (1–15). */
  members: number;
  /** Everything paid to the scheme each month, by the person and their employer. */
  monthlyTotal: number | null;
  paidBy: MedicalPaidBy;
  /** The employer's share per month, when shared. */
  employerShare: number | null;
  /** How the person's own share is paid: off the payslip, or by debit order. */
  ownSharePaidVia: MedicalPaidVia;
  /** Costs the scheme didn't cover this year. Null = not given, so the extra credit isn't worked out. */
  outOfPocketAnnual: number | null;
}

export interface VariableAnswers {
  /** Null until they choose; an empty list means "none of these". */
  types: VariableType[] | null;
  bonusAnnual: number | null;
  overtimeAnnual: number | null;
  commissionAnnual: number | null;
}

export interface ExtrasAnswers {
  /** Donations to approved charities this tax year (Section 18A). */
  donationsAnnual: number | null;
  has18AReceipt: boolean;
  /** Interest from South African banks this tax year. */
  interestAnnual: number | null;
  /** A fixed travel allowance paid with the salary, per month. */
  travelAllowanceMonthly: number | null;
  /** Is 80% or more of the driving for work? */
  travelBusinessHigh: boolean;
  travelKmAnnual: number | null;
  hasSecondEmployer: boolean;
  secondEmployerAnnual: number | null;
  /** Months on a medical scheme this tax year (0–12). Only used when they belong to one. */
  medicalMonths: number;
  /** Someone in the family has a disability (changes the extra medical credit). Only used with a medical aid. */
  disability: boolean;
}

/** What the latest payslip shows, for one pay period (PRD §8 Step 7). */
export interface PayslipAnswers {
  paye: number | null;
  uif: number | null;
}

export interface WizardAnswers {
  /**
   * The tax year the calculation is for. Always the person's explicit choice, starting at the default year, and never
   * worked out from the date (PRD §8). Changing it keeps every other answer and recalculates with that year's rules.
   */
  taxYear: TaxYear;
  /**
   * The year the age answer was given for. Age is "your age on the last day of the tax year", so the same answer can
   * mean something different in another year. When this differs from `taxYear` and the band could change, the
   * person is asked to confirm it before any numbers are shown (see {@link ageNeedsConfirmation}).
   */
  ageBandYear: TaxYear;
  /** How they want to start (step 0). Null until they choose. */
  mode: CalculationMode | null;
  /** The amount for the chosen mode, per pay period. Null until entered. */
  amount: number | null;
  /** The very-high amount the person confirmed is correct (PRD §9). Null if none. */
  confirmedHighAmount: number | null;
  payFrequency: PayFrequency;
  /** Defaults to "younger than 65" if the question is skipped (PRD §8 Step 2). */
  ageBand: AgeBand;
  retirement: RetirementAnswers;
  medical: MedicalAnswers;
  variable: VariableAnswers;
  extras: ExtrasAnswers;
  payslip: PayslipAnswers;
}

export const INITIAL_ANSWERS: WizardAnswers = {
  taxYear: DEFAULT_TAX_YEAR,
  ageBandYear: DEFAULT_TAX_YEAR,
  mode: null,
  amount: null,
  confirmedHighAmount: null,
  payFrequency: "MONTHLY",
  ageBand: "UNDER_65",
  retirement: { has: null, payslipMonthly: null, raMonthly: null, employerContributes: false, employerMonthly: null },
  medical: {
    member: null,
    members: 1,
    monthlyTotal: null,
    paidBy: "SELF",
    employerShare: null,
    ownSharePaidVia: "PAYROLL",
    outOfPocketAnnual: null,
  },
  variable: { types: null, bonusAnnual: null, overtimeAnnual: null, commissionAnnual: null },
  extras: {
    donationsAnnual: null,
    has18AReceipt: false,
    interestAnnual: null,
    travelAllowanceMonthly: null,
    travelBusinessHigh: false,
    travelKmAnnual: null,
    hasSecondEmployer: false,
    secondEmployerAnnual: null,
    medicalMonths: 12,
    disability: false,
  },
  payslip: { paye: null, uif: null },
};

/** Above this per-pay-period amount we ask "are you sure?" (PRD §9). */
export const MAX_REASONABLE_AMOUNT = 10_000_000;

export const MIN_MEDICAL_MEMBERS = 1;
export const MAX_MEDICAL_MEMBERS = 15;

/** An optional amount is fine when it is empty or a number from R0 up. */
const fine = (v: number | null) => v === null || (Number.isFinite(v) && v >= 0);
const orZero = (v: number | null) => (v !== null && Number.isFinite(v) ? v : 0);

// ---------------------------------------------------------------------------
// Is each step finished?
// ---------------------------------------------------------------------------

/** Is the amount something we can continue with? Empty and negative aren't; very high needs confirming. */
export function isAmountValid(a: WizardAnswers): boolean {
  const { amount } = a;
  if (amount === null || !Number.isFinite(amount) || amount < 0) return false;
  return amount <= MAX_REASONABLE_AMOUNT || a.confirmedHighAmount === amount;
}

/** Enough answers to work out a result (steps 0 and 1; everything else has a default). */
export function hasMinimumAnswers(a: WizardAnswers): boolean {
  return a.mode !== null && isAmountValid(a);
}

/** "No" is enough. "Yes" needs at least one contribution, and no negative amounts. */
export function isRetirementComplete(a: WizardAnswers): boolean {
  const r = a.retirement;
  if (r.has === null) return false;
  if (!r.has) return true;
  const employer = r.employerContributes ? r.employerMonthly : null;
  if (![r.payslipMonthly, r.raMonthly, employer].every(fine)) return false;
  return orZero(r.payslipMonthly) + orZero(r.raMonthly) + orZero(employer) > 0;
}

/** "No" is enough. "Yes" needs a plan size, a monthly total, and a sensible employer share if shared. */
export function isMedicalComplete(a: WizardAnswers): boolean {
  const m = a.medical;
  if (m.member === null) return false;
  if (!m.member) return true;
  if (!Number.isInteger(m.members) || m.members < MIN_MEDICAL_MEMBERS || m.members > MAX_MEDICAL_MEMBERS) return false;
  if (m.monthlyTotal === null || !fine(m.monthlyTotal)) return false;
  if (m.paidBy === "SHARED") {
    if (m.employerShare === null || !fine(m.employerShare) || m.employerShare > m.monthlyTotal) return false;
  }
  return fine(m.outOfPocketAnnual);
}

/** Optional extras never block, unless an amount is negative. */
export function isExtrasComplete(a: WizardAnswers): boolean {
  const e = a.extras;
  const amounts = [e.donationsAnnual, e.interestAnnual, e.travelAllowanceMonthly, e.travelKmAnnual, e.hasSecondEmployer ? e.secondEmployerAnnual : null];
  return amounts.every(fine) && Number.isInteger(e.medicalMonths) && e.medicalMonths >= 0 && e.medicalMonths <= 12;
}

/** How many of the optional extras have something filled in (shown as "N filled"). */
export function extrasFilledCount(a: WizardAnswers): number {
  const e = a.extras;
  const has = (v: number | null) => v !== null && v > 0;
  const checks = [
    has(e.donationsAnnual),
    has(e.interestAnnual),
    has(e.travelAllowanceMonthly),
    e.hasSecondEmployer,
    a.medical.member === true && e.medicalMonths !== 12,
    a.medical.member === true && e.disability,
  ];
  return checks.filter(Boolean).length;
}

/** The payslip check only applies when they started from a gross salary or a payslip (D7). */
export function payslipApplies(a: WizardAnswers): boolean {
  return a.mode !== "TAKE_HOME";
}

/** PAYE is needed in payslip mode (R0 is fine) and optional when they started from gross. Negatives block. */
export function isPayslipComplete(a: WizardAnswers): boolean {
  const { paye, uif } = a.payslip;
  if (!fine(paye) || !fine(uif)) return false;
  return a.mode === "PAYSLIP" ? paye !== null : true;
}

const VARIABLE_FIELD: Record<VariableType, keyof Omit<VariableAnswers, "types">> = {
  BONUS: "bonusAnnual",
  OVERTIME: "overtimeAnnual",
  COMMISSION: "commissionAnnual",
};

export const variableField = (type: VariableType) => VARIABLE_FIELD[type];

/** "None of these" is enough. Each type they pick needs a rough yearly amount. */
export function isVariableComplete(a: WizardAnswers): boolean {
  const { types } = a.variable;
  if (types === null) return false;
  return types.every((t) => {
    const v = a.variable[VARIABLE_FIELD[t]];
    return v !== null && fine(v);
  });
}

/** Adds or removes a type of extra pay. Taking off the last one goes back to "not answered". */
export function toggleVariableType(types: VariableType[] | null, type: VariableType): VariableType[] | null {
  const current = types ?? [];
  if (current.includes(type)) {
    const rest = current.filter((t) => t !== type);
    return rest.length === 0 ? null : rest;
  }
  return [...current, type];
}

// ---------------------------------------------------------------------------
// Answers → engine
// ---------------------------------------------------------------------------

/** Turns the answers into engine inputs. Missing answers become safe defaults. */
export function toEngineInputs(a: WizardAnswers): CalculationInputs {
  const r = a.retirement;
  const m = a.medical;
  const v = a.variable;
  const e = a.extras;
  const picked = (t: VariableType) => (v.types?.includes(t) ? orZero(v[VARIABLE_FIELD[t]]) : 0);

  const retirement = r.has
    ? {
        ownMonthly: orZero(r.payslipMonthly),
        employerMonthly: r.employerContributes ? orZero(r.employerMonthly) : 0,
        privateRaMonthly: orZero(r.raMonthly),
      }
    : { ownMonthly: 0, employerMonthly: 0 };

  const medical: MedicalInputs = m.member
    ? {
        member: true,
        members: m.members,
        monthlyContribution: orZero(m.monthlyTotal),
        paidBy: m.paidBy,
        ownSharePaidVia: m.ownSharePaidVia,
        monthsCovered: e.medicalMonths,
        disabilityInFamily: e.disability,
        ...(m.paidBy === "SHARED" ? { employerMonthly: orZero(m.employerShare) } : {}),
        ...(m.outOfPocketAnnual === null ? {} : { outOfPocketAnnual: orZero(m.outOfPocketAnnual) }),
      }
    : { member: false, members: 1, monthlyContribution: 0, paidBy: "SELF" };

  const advanced: AdvancedInputs = {
    donations18AAnnual: orZero(e.donationsAnnual),
    has18AReceipt: e.has18AReceipt,
    localInterestAnnual: orZero(e.interestAnnual),
    travelAllowanceMonthly: orZero(e.travelAllowanceMonthly),
    // 80% or more business use makes only 20% of the allowance taxable; anything less, 80%.
    travelBusinessUse: e.travelBusinessHigh ? 0.8 : 0,
    travelBusinessKmAnnual: orZero(e.travelKmAnnual),
    hasSecondEmployer: e.hasSecondEmployer,
    ...(e.hasSecondEmployer && e.secondEmployerAnnual !== null ? { secondEmployerAnnualGross: orZero(e.secondEmployerAnnual) } : {}),
  };

  // The payslip only counts when they started from a gross salary or a payslip (D7).
  const payslip: PayslipInputs = payslipApplies(a)
    ? {
        ...(a.payslip.paye === null ? {} : { payePerPeriod: orZero(a.payslip.paye) }),
        ...(a.payslip.uif === null ? {} : { uifPerPeriod: orZero(a.payslip.uif) }),
      }
    : {};

  return {
    taxYear: a.taxYear,
    mode: a.mode ?? "GROSS",
    amount: a.amount ?? 0,
    payFrequency: a.payFrequency,
    ageBand: a.ageBand,
    retirement,
    medical,
    variablePay: {
      bonusAnnual: picked("BONUS"),
      overtimeAnnual: picked("OVERTIME"),
      commissionAnnual: picked("COMMISSION"),
    },
    advanced,
    payslip,
  };
}

// ---------------------------------------------------------------------------
// Changing the tax year
// ---------------------------------------------------------------------------

/**
 * Could this age band be different in the other year? Age is measured on the last day of the tax year (PRD §8 Step 2),
 * so a later year can only make a person older and an earlier year only younger. Someone "younger than 65" cannot
 * have been 65 a year earlier, and someone 75 or older cannot get any older, so those two answers stay right.
 * Years are ordered by their names ("2025-26" before "2026-27").
 */
export function ageCouldDiffer(from: TaxYear, to: TaxYear, band: AgeBand): boolean {
  if (from === to) return false;
  return to > from ? band !== "AGE_75_PLUS" : band !== "UNDER_65";
}

/** Switches the year, keeping every answer. Whether the age group needs checking is worked out from where it was given. */
export function changeTaxYear(state: WizardAnswers, year: TaxYear): WizardAnswers {
  return year === state.taxYear ? state : { ...state, taxYear: year };
}

/**
 * The age group was given for another year and could be different in the one on screen: ask before showing numbers.
 * Worked out against the year the person actually answered for, so going away and coming back to that year never asks.
 */
export function ageNeedsConfirmation(a: WizardAnswers): boolean {
  return ageCouldDiffer(a.ageBandYear, a.taxYear, a.ageBand);
}

/** Applies a change. Switching how they start clears the amount, because it would mean something different. */
export function applyPatch(state: WizardAnswers, patch: Partial<WizardAnswers>): WizardAnswers {
  // A change that changes nothing returns the same object, so React doesn't re-render for it.
  const unchanged = (Object.keys(patch) as (keyof WizardAnswers)[]).every((key) => state[key] === patch[key]);
  if (unchanged) return state;

  const next = { ...state, ...patch };
  if (patch.mode !== undefined && patch.mode !== state.mode && patch.amount === undefined) {
    next.amount = null;
    next.confirmedHighAmount = null;
  }
  // Answering the age question is answering it for the year on screen.
  if (patch.ageBand !== undefined && patch.ageBandYear === undefined) next.ageBandYear = next.taxYear;
  return next;
}
