/**
 * Type definitions for the tax engine (PRD §10.2).
 *
 * The engine keeps two views of the year apart:
 * - the PAYROLL view: what this employer can see and withholds PAYE on;
 * - the FULL view: everything, giving the final tax for the year.
 * The difference is settled when the tax return is filed (refund or amount owed).
 */

export type TaxYear = "2025-26" | "2026-27";

/**
 * Whether a rule set has been independently checked and signed off (PRD §6.16, §10.5).
 * A "draft" year can be used in development but must never be offered in a production build.
 */
export type RuleSetStatus = "draft" | "verified";

export type AgeBand = "UNDER_65" | "AGE_65_74" | "AGE_75_PLUS";

/** Appendix A source IDs (S1–S15) from the PRD. */
export type SourceId =
  | "S1" | "S2" | "S3" | "S4" | "S5" | "S6" | "S7" | "S8"
  | "S9" | "S10" | "S11" | "S12" | "S13" | "S14" | "S15"
  /** Added for 2025/26: S16 = SARS Budget 2025 tax guide, S17 = Gazette notice fixing the rate per kilometre. */
  | "S16" | "S17";

/**
 * One income tax bracket.
 *
 * Tax for income inside the bracket = base + rate × (income − from).
 * `from` is the amount the bracket's rate applies *above* (exclusive), so
 * bracket 2 has from = 245 100 and covers R245 101 – R383 100.
 * `to` is inclusive; `null` means no upper limit.
 */
export interface TaxBracket {
  from: number;
  to: number | null;
  base: number;
  rate: number;
}

export interface TaxRuleSet {
  taxYear: TaxYear;
  /** Human label, e.g. "2026/27". */
  label: string;
  /** Draft until independently signed off. Nothing selects a year on its own: see the registry. */
  status: RuleSetStatus;
  /** Changes whenever any value in this rule set changes (it will key cached results). */
  rulesVersion: string;
  startDate: string;
  endDate: string;
  /** When the parameters were last checked against the sources (PRD Q3). */
  lastVerified: string;
  brackets: readonly TaxBracket[];
  rebates: { primary: number; secondary65: number; tertiary75: number };
  thresholds: { under65: number; age65to74: number; age75plus: number };
  uif: { employeeRate: number; monthlyCeiling: number; maxMonthlyEmployee: number };
  retirement11F: { rate: number; annualCap: number };
  medical6A: { monthlyMain: number; monthlyFirstDep: number; monthlyAdditionalDep: number };
  medical6B: {
    under65: { multiplier: number; contributionMultiple: number; incomeThresholdRate: number };
    olderOrDisabled: { multiplier: number; contributionMultiple: number };
  };
  donations18A: { limitRate: number };
  interestExemption: { under65: number; age65plus: number };
  tfsa: { annualLimit: number; lifetimeLimit: number; excessPenaltyRate: number };
  travel: {
    prescribedRatePerKm: number;
    taxableDefaultRate: number;
    taxableBusinessRate: number;
    businessUseThreshold: number;
  };
  /** Reference values used only for flags and education (PRD §6.14). */
  reference: { donationsTaxAnnualExemption: number };
  /**
   * Where the product's own advice thresholds sit. These are not SARS figures: they are choices the calculator
   * makes, kept here so each year can set them against that year's brackets instead of a number in the logic.
   * `topBracketRate`: from this marginal rate up, "each rand saved is worth the most" is worth saying (PRD R9).
   * It must be the rate of one of the year's brackets (assertValidRuleSet checks).
   */
  guidance: { topBracketRate: number };
  monthsPerYear: number;
  effectiveDates: Record<string, string>;
  /** Which Appendix A source(s) each parameter group comes from. */
  sources: Record<string, readonly SourceId[]>;
}

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export type PayFrequency = "MONTHLY" | "WEEKLY" | "FORTNIGHTLY";
export type FundType = "PENSION" | "PROVIDENT" | "RA";

/** How the user starts (PRD §8 Step 0). */
export type CalculationMode = "GROSS" | "TAKE_HOME" | "PAYSLIP";

export type Confidence = "ESTIMATE" | "PAYSLIP_ACCURATE";

/**
 * Who pays the medical scheme contribution.
 * - SELF: the whole contribution is the employee's own.
 * - EMPLOYER: the employer pays it all as a benefit (a taxable fringe benefit, PRD §6.13).
 * - SHARED: the employer pays `employerMonthly`; the employee pays the rest.
 */
export type MedicalPaidBy = "SELF" | "EMPLOYER" | "SHARED";

/**
 * How the employee's own medical aid share is paid.
 * - PAYROLL: deducted on the payslip, so it reduces the bank deposit and payroll applies the 6A credit monthly.
 * - DEBIT_ORDER: paid privately. The deposit is not reduced, and payroll is assumed not to apply
 *   the credit — it is claimed back when the tax return is filed (PRD §6.7).
 */
export type MedicalPaidVia = "PAYROLL" | "DEBIT_ORDER";

export interface RetirementInputs {
  /** Employee's own contribution per month, deducted on the payslip (pension, provident, employer-run RA). */
  ownMonthly: number;
  /** Employer contribution per month — a taxable fringe benefit that is also deductible. */
  employerMonthly: number;
  /**
   * Retirement annuity paid privately by debit order, per month. Payroll doesn't see it, so it
   * doesn't reduce the bank deposit or monthly PAYE; the tax saving comes back on filing.
   */
  privateRaMonthly?: number;
  /** Informational only: every fund type shares the same Section 11F limit. */
  fundTypes?: readonly FundType[];
}

export interface MedicalInputs {
  member: boolean;
  /** People on the plan, including the main member (1–15). */
  members: number;
  /** Total scheme contribution per month (employee + employer). */
  monthlyContribution: number;
  paidBy: MedicalPaidBy;
  /** Employer's share per month, used only when paidBy is SHARED. */
  employerMonthly?: number;
  /** Months of membership in the tax year (0–12). Defaults to 12. */
  monthsCovered?: number;
  /** How the employee's own share is paid. Defaults to PAYROLL. */
  ownSharePaidVia?: MedicalPaidVia;
  /**
   * Qualifying medical costs not covered by the scheme, for the year. Section 6B is worked out
   * only when this is given (even as 0); it also applies without scheme membership.
   */
  outOfPocketAnnual?: number;
  /** Taxpayer, spouse or child has a disability — uses the 33.3% branch of Section 6B. */
  disabilityInFamily?: boolean;
}

export interface VariablePayInputs {
  /** Expected totals for this tax year. */
  bonusAnnual?: number;
  overtimeAnnual?: number;
  commissionAnnual?: number;
}

/** PRD §8 Step 6 "Optional extras". */
export interface AdvancedInputs {
  /** Donations to Section 18A-approved organisations this year. */
  donations18AAnnual?: number;
  has18AReceipt?: boolean;
  /** Interest from South African banks and fixed deposits this year. */
  localInterestAnnual?: number;
  /** Fixed travel allowance paid with the salary, per month. */
  travelAllowanceMonthly?: number;
  /** Share of vehicle use that is business (0–1). ≥ 0.8 makes only 20% of the allowance taxable. */
  travelBusinessUse?: number;
  /** Business kilometres this year, for the possible deduction estimate. */
  travelBusinessKmAnnual?: number;
  /** Worked for more than one employer this tax year (E10). */
  hasSecondEmployer?: boolean;
  /** Gross income from another employer this tax year (optional even when hasSecondEmployer). */
  secondEmployerAnnualGross?: number;
}

/** What the payslip actually shows (PRD §8 Step 7). */
export interface PayslipInputs {
  /** PAYE deducted this month. Required for the comparison. */
  payeMonthly?: number;
  /** UIF deducted this month. Assumed from the calculation when missing. */
  uifMonthly?: number;
  /**
   * PAYE as printed on one payslip, for one pay period. Turned into a monthly figure using the pay
   * frequency (weekly × 52/12, fortnightly × 26/12). Ignored when payeMonthly is also given.
   */
  payePerPeriod?: number;
  /** UIF as printed on one payslip, for one pay period. Ignored when uifMonthly is also given. */
  uifPerPeriod?: number;
}

export interface CalculationInputs {
  /**
   * The tax year to calculate for. Defaults to the default year when left out. It is never worked out from the
   * date, and a rule set for another year is refused (PRD §8, §10.5).
   */
  taxYear?: TaxYear;
  /** Defaults to GROSS. */
  mode?: CalculationMode;
  /**
   * Per pay period: the gross cash salary (GROSS / PAYSLIP), or the regular
   * bank deposit excluding bonuses (TAKE_HOME).
   */
  amount: number;
  /** Defaults to MONTHLY. */
  payFrequency?: PayFrequency;
  ageBand: AgeBand;
  retirement?: RetirementInputs;
  medical?: MedicalInputs;
  variablePay?: VariablePayInputs;
  advanced?: AdvancedInputs;
  payslip?: PayslipInputs;
}

// ---------------------------------------------------------------------------
// Result
// ---------------------------------------------------------------------------

export type WarningCode =
  /** Own deductions plus PAYE and UIF are more than the salary (PRD E17). */
  | "DEDUCTIONS_EXCEED_GROSS"
  /** Variable pay is more than 3× the annual salary; the estimate is rougher (PRD §8 Step 5). */
  | "VARIABLE_PAY_HIGH"
  /** Payslip UIF is above the legal maximum (PRD §8 Step 7). */
  | "PAYSLIP_UIF_ABOVE_MAX"
  /** Payslip PAYE is more than the gross salary. */
  | "PAYSLIP_PAYE_ABOVE_GROSS";

/** Assumptions and simplifications the UI must disclose. */
export type NoteCode =
  /** Gross was estimated from take-home pay (PRD §10.3 Step B). */
  | "ESTIMATED_FROM_TAKE_HOME"
  /** Tax on extras uses the balance-of-remuneration method; payroll may use another SARS-allowed method (E8). */
  | "VARIABLE_PAY_BALANCE_METHOD"
  /** UIF on extras is averaged over the year rather than worked out in the month paid (PRD Step I). */
  | "UIF_ON_AVERAGED_VARIABLE_PAY"
  /** Medical aid paid by debit order: payroll doesn't apply the credit; it's claimed on filing. */
  | "MEDICAL_CREDIT_CLAIMED_ON_FILING"
  /** Private RA: payroll doesn't deduct it; the saving comes back on filing. */
  | "PRIVATE_RA_CLAIMED_ON_FILING"
  /** Section 6B uses the total scheme contribution, including the employer's share (PRD §6.8, Q4). */
  | "MEDICAL_6B_INCLUDES_EMPLOYER_CONTRIBUTIONS"
  /** The other employer's PAYE is estimated as if that job were your only income (E10). */
  | "SECOND_EMPLOYER_PAYE_ESTIMATED"
  /** Payslip UIF was not given, so the calculated figure was assumed (E7). */
  | "PAYSLIP_UIF_ASSUMED";

/** Exclusions and things to know (PRD §5.2, §14.7). */
export type FlagCode =
  | "OTHER_INCOME_NOT_INCLUDED"
  | "CAPITAL_GAINS_NOT_INCLUDED"
  | "FOREIGN_INCOME_OR_RESIDENCY"
  | "FRINGE_BENEFITS_NOT_MODELLED"
  | "HOME_OFFICE_NOT_MODELLED"
  | "SDL_COIDA_EMPLOYER_ONLY"
  | "RETIREMENT_LUMP_SUMS_NOT_CALCULATED"
  | "COMMISSION_EARNER_DEDUCTIONS"
  | "DONATIONS_TAX_LARGE_GIFTS"
  | "DONATION_RECEIPT_NEEDED"
  | "MULTIPLE_EMPLOYERS"
  | "BELOW_THRESHOLD_MAY_NOT_NEED_TO_FILE"
  | "TRAVEL_LOGBOOK_REQUIRED"
  | "DIVIDENDS_NOT_INCLUDED"
  | "MEDICAL_6B_POSSIBLE";

export interface Flag {
  code: FlagCode;
  /** Appendix A source to link to. */
  source: SourceId;
}

export interface BracketWalkRow {
  /** 0-based bracket index. */
  index: number;
  from: number;
  to: number | null;
  rate: number;
  /** Portion of the taxpayer's taxable income that falls inside this bracket. */
  amountInBracket: number;
  /** Tax on that portion. */
  taxInBracket: number;
  /** Cumulative tax up to and including this bracket. */
  runningTotal: number;
  /** True for the bracket the taxpayer's last rand falls in. */
  isTopBracket: boolean;
}

export interface RebateBreakdown {
  primary: number;
  secondary: number;
  tertiary: number;
  total: number;
}

export interface RetirementResult {
  fundTypes: FundType[];
  /** Remuneration used for the 27.5% test: cash pay plus fringe benefits (not interest). */
  remunerationAnnual: number;
  /** Own (payroll) + private RA + employer contributions for the year. */
  poolAnnual: number;
  /** 27.5% of the greater of remuneration or taxable income before this deduction. */
  percentageLimitAnnual: number;
  /** The limit actually applied: the percentage limit or the rand cap, whichever is lower. */
  limitAnnual: number;
  capApplied: boolean;
  deductionAnnual: number;
  deductionMonthly: number;
  /** Contributions above the limit — not lost, carried forward to later years (PRD §6.6). */
  carryForwardAnnual: number;
  /** Your own contributions (payslip + private RA) as a percentage of cash salary, to 1 decimal (0 with no salary). */
  ownPercentOfGross: number;
}

export interface Medical6AResult {
  members: number;
  monthsCovered: number;
  /** Monthly credit for the dependants after the first, combined. */
  additionalDependantsMonthly: number;
  monthlyCredit: number;
  annualCredit: number;
  /** Credit actually used; it can't push tax below R0 (non-refundable). */
  appliedAnnual: number;
  unusedAnnual: number;
}

export interface Medical6BResult {
  /** NOT_PROVIDED: no out-of-pocket figure given, so not worked out (PRD §6.8). */
  status: "NOT_PROVIDED" | "CALCULATED";
  branch: "UNDER_65" | "AGE_65_OR_DISABILITY";
  outOfPocketAnnual: number;
  /** Total scheme contributions for the year (employee + employer). */
  contributionsAnnual: number;
  annualCredit: number;
  /** Credit actually used after rebates and Section 6A. */
  appliedAnnual: number;
}

export interface DonationsResult {
  givenAnnual: number;
  hasReceipt: boolean;
  /** 10% of taxable income before the donation deduction. */
  capAnnual: number;
  deductionAnnual: number;
  /** Excess over the cap, treated as a donation next year (PRD §6.9). */
  carryForwardAnnual: number;
}

export interface InterestResult {
  localAnnual: number;
  exemptionAnnual: number;
  /** The part of the interest that is tax-free: min(interest, exemption). */
  exemptAnnual: number;
  taxableAnnual: number;
}

export interface TravelResult {
  allowanceMonthly: number;
  allowanceAnnual: number;
  /** 0.8, or 0.2 when business use is at least 80%. */
  taxableRate: number;
  taxableMonthly: number;
  taxableAnnual: number;
  businessKmAnnual: number;
  /** Business km × prescribed rate, capped at the allowance. An estimate: needs a logbook. Not applied. */
  possibleDeductionAnnual: number;
}

export interface SecondEmployerResult {
  grossAnnual: number;
  /** Estimated PAYE that employer withholds, treating that job as the only income. */
  estimatedPayeAnnual: number;
}

export interface FilingResult {
  /** Final tax − all PAYE withheld. Positive = owed to SARS; negative = refund. */
  balanceAnnual: number;
  refundAnnual: number;
  owedAnnual: number;
}

export interface PayslipComparison {
  payslipPaye: number;
  /** Monthly PAYE this payroll should withhold in a normal month. */
  calcPaye: number;
  /** payslipPaye − calcPaye. */
  diff: number;
  /** diff ÷ calcPaye × 100; null when the calculated PAYE is R0. */
  diffPct: number | null;
  /** Within R1 — treat as the same. */
  closeMatch: boolean;
  payslipUif: number;
  calcUif: number;
  uifAssumed: boolean;
}

export interface VariablePayResult {
  bonusAnnual: number;
  overtimeAnnual: number;
  commissionAnnual: number;
  totalAnnual: number;
  /** totalAnnual ÷ 12, rounded to cents — the extras in an averaged month. */
  monthlyAverage: number;
  /** PAYE attributable to the extras: tax(all income) − tax(regular income). */
  taxAnnual: number;
  /** taxAnnual ÷ totalAnnual (0 when there are no extras). */
  effectiveRate: number;
}

export interface EstimateDetails {
  targetPerPeriod: number;
  targetMonthly: number;
  method: "NONE" | "FIXED_POINT" | "BISECTION";
  iterations: number;
  /** Target − achieved regular monthly take-home, after rounding the gross to cents. */
  residual: number;
}

/** Which rules produced a result (PRD §10.1, §10.5). */
export interface Provenance {
  /** Same as `taxYear`; kept under its first name. */
  ruleSetVersion: TaxYear;
  taxYear: TaxYear;
  /** The rule set's own version: it changes whenever any value in it changes. */
  rulesVersion: string;
  status: RuleSetStatus;
  /** First and last day of the year of assessment, ISO dates. */
  period: { start: string; end: string };
  /** When the rule set was last checked against its sources. */
  lastVerifiedAt: string;
  /** Every source ID the rule set cites, sorted. */
  sourceIds: SourceId[];
  appliedRules: string[];
}

export interface CalculationResult {
  taxYear: TaxYear;
  mode: CalculationMode;
  confidence: Confidence;
  /** Present in TAKE_HOME mode only. */
  estimate?: EstimateDetails;
  ageBand: AgeBand;
  payFrequency: PayFrequency;
  periodsPerYear: number;
  /** The cash salary per pay period (as entered, or estimated). */
  grossPerPeriod: number;
  /** Monthly equivalent of the cash salary (weekly × 52/12, fortnightly × 26/12). */
  grossMonthly: number;
  grossAnnual: number;
  employerRetirementMonthly: number;
  employerRetirementAnnual: number;
  employerMedicalMonthly: number;
  employerMedicalAnnual: number;
  /** Own retirement contribution deducted on the payslip. */
  ownRetirementMonthly: number;
  ownRetirementAnnual: number;
  /** Private RA paid by debit order. */
  privateRaMonthly: number;
  privateRaAnnual: number;
  /** Employee's own medical aid share, however it is paid. */
  ownMedicalMonthly: number;
  ownMedicalAnnual: number;
  ownMedicalPaidVia: MedicalPaidVia;
  variablePay: VariablePayResult;
  travel: TravelResult;
  interest: InterestResult;
  secondEmployer: SecondEmployerResult;
  /** All income before deductions: cash pay, extras, fringe benefits, taxable allowance, interest, other job. */
  incomeBeforeDeductions: number;
  retirement: RetirementResult;
  donations: DonationsResult;
  taxableIncome: number;
  annualTaxBeforeRebates: number;
  rebates: RebateBreakdown;
  /** Tax after rebates, floored at R0. */
  taxAfterRebates: number;
  medical6A: Medical6AResult;
  medical6B: Medical6BResult;
  /** Final tax for the year after every rebate and credit. */
  annualLiability: number;
  /** PAYE this employer withholds over the year (regular months + extras). */
  annualPaye: number;
  /** PAYE withheld over the year on regular pay only (annualPaye − tax on extras). */
  annualPayeRegular: number;
  /** PAYE in a normal month — regular pay only, no bonus (D4). */
  monthlyPaye: number;
  /** annualPaye ÷ 12: PAYE averaged over the year including extras. */
  monthlyPayeAverage: number;
  /** What happens when the return is filed. */
  filing: FilingResult;
  /** UIF in a normal month. */
  uifMonthly: number;
  /** UIF averaged over the year including extras. */
  uifMonthlyAverage: number;
  uifAnnual: number;
  /**
   * Bank deposit in a normal month: cash salary + travel allowance − own retirement (payroll)
   * − own medical (payroll) − PAYE − UIF. Can be negative (see warnings).
   */
  takeHomeMonthly: number;
  /** Average monthly deposit over the year, including extras after their tax. */
  takeHomeMonthlyAverage: number;
  takeHomeAnnual: number;
  /** Normal-month take-home per actual pay period (equals monthly for monthly pay). */
  takeHomePerPeriod: number;
  /** UIF in a normal pay period (equals uifMonthly for monthly pay). */
  uifPerPeriod: number;
  comparison?: PayslipComparison;
  /** 0-based index of the bracket the last rand of taxable income falls in. */
  bracketIndex: number;
  /** The rate of that bracket. */
  bracketRate: number;
  /**
   * Tax on the next rand earned. Equals the bracket rate when tax is payable,
   * and 0 while rebates and credits cover all the tax.
   */
  marginalRate: number;
  /** Final tax as a share of income before deductions (0 when there is no income). */
  effectiveRate: number;
  /** The age-based tax-free threshold (PRD §6.3). */
  taxThreshold: number;
  /** True when taxable income is at or below the threshold, so no tax is due. */
  belowThreshold: boolean;
  bracketWalk: BracketWalkRow[];
  warnings: WarningCode[];
  notes: NoteCode[];
  flags: Flag[];
  /** Which rule-set entries produced this result (PRD §10.1). */
  provenance: Provenance;
}
