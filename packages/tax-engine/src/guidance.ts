import { assertSameYear, calculate } from "./calculate.ts";
import { Decimal, dec, round2, toCents } from "./money.ts";
import type { AgeBand, CalculationInputs, CalculationResult, TaxRuleSet } from "./types.ts";

/**
 * "How your answers shaped your tax" and "Ways to keep more of your pay" (PRD §14.5, §14.6).
 * Both are data only: numbers and codes, no sentences. The page chooses the words, and every rand
 * figure on it comes from here. Tax savings are worked out by running the calculation again with
 * one thing changed (the same gross pay), so they include bracket edges, rebates and credits instead
 * of a rule of thumb.
 */

// ---------------------------------------------------------------------------
// What-if helper
// ---------------------------------------------------------------------------

/** Final tax for the year if `change` were made, with the gross pay held fixed. */
function liabilityWith(
  rules: TaxRuleSet,
  inputs: CalculationInputs,
  result: CalculationResult,
  change: (i: CalculationInputs) => CalculationInputs = (i) => i,
): Decimal {
  const { payslip: _ignored, ...rest } = inputs;
  const fixed: CalculationInputs = { ...rest, mode: "GROSS", amount: result.grossPerPeriod };
  return dec(calculate(rules, change(fixed)).annualLiability);
}

const withOwnRetirement =
  (ownMonthly: number, privateRaMonthly: number) =>
  (i: CalculationInputs): CalculationInputs => ({
    ...i,
    retirement: { employerMonthly: 0, ...i.retirement, ownMonthly, privateRaMonthly },
  });

const withDonations = (donations18AAnnual: number) => (i: CalculationInputs): CalculationInputs => ({
  ...i,
  advanced: { ...i.advanced, donations18AAnnual },
});

const monthly = (annual: Decimal) => round2(annual.dividedBy(12)).toNumber();

// ---------------------------------------------------------------------------
// Explanations (PRD §14.5)
// ---------------------------------------------------------------------------

export type Explanation =
  | {
      id: "RETIREMENT";
      /** Your own contributions (payslip plus private RA) per month. */
      contributedMonthly: number;
      deductionAnnual: number;
      savingMonthly: number;
      savingAnnual: number;
      marginalRate: number;
      carryForwardAnnual: number;
      annualCap: number;
    }
  | {
      id: "MEDICAL_CREDIT";
      members: number;
      monthlyCredit: number;
      mainMonthly: number;
      firstDependantMonthly: number;
      additionalMonthly: number;
      annualCredit: number;
      /** What actually came off the tax (it can't push tax below R0). */
      appliedAnnual: number;
      /** The part of the credit that couldn't be used: it never takes tax below R0 and isn't paid out. */
      unusedAnnual: number;
      claimedOnFiling: boolean;
    }
  | { id: "AGE_REBATE"; ageBand: Exclude<AgeBand, "UNDER_65">; secondary: number; tertiary: number; savingAnnual: number }
  | {
      id: "DONATIONS";
      givenAnnual: number;
      deductionAnnual: number;
      savingAnnual: number;
      carryForwardAnnual: number;
      hasReceipt: boolean;
    }
  | { id: "VARIABLE_PAY"; totalAnnual: number; taxAnnual: number; effectiveRate: number; marginalRate: number }
  | { id: "UIF"; monthly: number; annual: number; maxMonthly: number }
  | {
      id: "TRAVEL";
      allowanceAnnual: number;
      taxableRate: number;
      taxableAnnual: number;
      possibleDeductionAnnual: number;
    }
  | { id: "INTEREST"; interestAnnual: number; exemptionAnnual: number; taxableAnnual: number }
  | { id: "MEDICAL_6B"; outOfPocketAnnual: number; annualCredit: number; appliedAnnual: number };

export type ExplanationId = Explanation["id"];

/** One entry for each answer that changed the result, with its rand effect. */
export function buildExplanations(rules: TaxRuleSet, inputs: CalculationInputs, r: CalculationResult): Explanation[] {
  assertSameYear(rules, { taxYear: r.taxYear });
  assertSameYear(rules, inputs);
  const out: Explanation[] = [];

  const ownAnnual = dec(r.ownRetirementAnnual).plus(r.privateRaAnnual);
  if (ownAnnual.greaterThan(0)) {
    const saving = liabilityWith(rules, inputs, r, withOwnRetirement(0, 0)).minus(liabilityWith(rules, inputs, r));
    out.push({
      id: "RETIREMENT",
      contributedMonthly: monthly(ownAnnual),
      deductionAnnual: r.retirement.deductionAnnual,
      savingMonthly: monthly(saving),
      savingAnnual: toCents(saving),
      marginalRate: r.marginalRate,
      carryForwardAnnual: r.retirement.carryForwardAnnual,
      annualCap: rules.retirement11F.annualCap,
    });
  }

  if (r.medical6A.annualCredit > 0) {
    out.push({
      id: "MEDICAL_CREDIT",
      members: r.medical6A.members,
      monthlyCredit: r.medical6A.monthlyCredit,
      mainMonthly: rules.medical6A.monthlyMain,
      firstDependantMonthly: rules.medical6A.monthlyFirstDep,
      additionalMonthly: rules.medical6A.monthlyAdditionalDep,
      annualCredit: r.medical6A.annualCredit,
      appliedAnnual: r.medical6A.appliedAnnual,
      unusedAnnual: r.medical6A.unusedAnnual,
      claimedOnFiling: r.notes.includes("MEDICAL_CREDIT_CLAIMED_ON_FILING"),
    });
  }

  if (r.ageBand !== "UNDER_65") {
    // What the age rebates took off, on top of the primary rebate everyone gets.
    const primaryOnly = Decimal.max(dec(r.annualTaxBeforeRebates).minus(r.rebates.primary), 0);
    out.push({
      id: "AGE_REBATE",
      ageBand: r.ageBand,
      secondary: r.rebates.secondary,
      tertiary: r.rebates.tertiary,
      savingAnnual: toCents(primaryOnly.minus(r.taxAfterRebates)),
    });
  }

  if (r.donations.givenAnnual > 0) {
    const saving = liabilityWith(rules, inputs, r, withDonations(0)).minus(liabilityWith(rules, inputs, r));
    out.push({
      id: "DONATIONS",
      givenAnnual: r.donations.givenAnnual,
      deductionAnnual: r.donations.deductionAnnual,
      savingAnnual: toCents(saving),
      carryForwardAnnual: r.donations.carryForwardAnnual,
      hasReceipt: r.donations.hasReceipt,
    });
  }

  if (r.variablePay.totalAnnual > 0) {
    out.push({
      id: "VARIABLE_PAY",
      totalAnnual: r.variablePay.totalAnnual,
      taxAnnual: r.variablePay.taxAnnual,
      effectiveRate: r.variablePay.effectiveRate,
      marginalRate: r.marginalRate,
    });
  }

  if (r.uifMonthly > 0) {
    out.push({ id: "UIF", monthly: r.uifMonthly, annual: r.uifAnnual, maxMonthly: rules.uif.maxMonthlyEmployee });
  }

  if (r.travel.allowanceAnnual > 0) {
    out.push({
      id: "TRAVEL",
      allowanceAnnual: r.travel.allowanceAnnual,
      taxableRate: r.travel.taxableRate,
      taxableAnnual: r.travel.taxableAnnual,
      possibleDeductionAnnual: r.travel.possibleDeductionAnnual,
    });
  }

  if (r.interest.localAnnual > 0) {
    out.push({
      id: "INTEREST",
      interestAnnual: r.interest.localAnnual,
      exemptionAnnual: r.interest.exemptionAnnual,
      taxableAnnual: r.interest.taxableAnnual,
    });
  }

  if (r.medical6B.appliedAnnual > 0) {
    out.push({
      id: "MEDICAL_6B",
      outOfPocketAnnual: r.medical6B.outOfPocketAnnual,
      annualCredit: r.medical6B.annualCredit,
      appliedAnnual: r.medical6B.appliedAnnual,
    });
  }

  return out;
}

// ---------------------------------------------------------------------------
// Recommendations (PRD §14.6)
// ---------------------------------------------------------------------------

export type RecommendationConfidence = "CALCULATED" | "ESTIMATED" | "INFORMATIONAL";

/**
 * Only CALCULATED recommendations carry rand savings. The others carry facts (limits, rules) or nothing.
 * R1/R2 use an example extra contribution that fits inside the room left under the Section 11F limit.
 */
export type Recommendation =
  | { id: "R1"; confidence: "CALCULATED"; roomAnnual: number; extraMonthly: number; monthlySaving: number; annualSaving: number }
  | { id: "R2"; confidence: "CALCULATED"; roomAnnual: number; extraMonthly: number; monthlySaving: number; annualSaving: number }
  | { id: "R3"; confidence: "CALCULATED"; monthlyCredit: number; claimedOnFiling: boolean }
  | { id: "R4"; confidence: "CALCULATED"; monthlyCredit: number; usableMonthly: number }
  | { id: "R5"; confidence: "CALCULATED"; exampleAnnual: number; annualSaving: number; limitRate: number }
  | { id: "R6"; confidence: "INFORMATIONAL"; exemptionAnnual: number; exemptionAge65: number; tfsaAnnual: number; tfsaLifetime: number; interestAnnual: number }
  | { id: "R7"; confidence: "INFORMATIONAL"; tfsaAnnual: number; tfsaLifetime: number }
  | { id: "R8"; confidence: "ESTIMATED" }
  | { id: "R9"; confidence: "CALCULATED"; marginalRate: number; centsPerRand: number };

export type RecommendationId = Recommendation["id"];

/** An example monthly amount is only worth showing if it is at least this much and fits in the room. */
const MIN_EXAMPLE_MONTHLY = 100;
const R1_EXAMPLE_MONTHLY = 1_000;
const R2_EXAMPLE_MONTHLY = 2_000;
const R5_EXAMPLE_DONATION = 1_000;
/** "Near" the interest exemption: at least this share of it. */
const INTEREST_NEAR_SHARE = 0.8;

export function buildRecommendations(rules: TaxRuleSet, inputs: CalculationInputs, r: CalculationResult): Recommendation[] {
  assertSameYear(rules, { taxYear: r.taxYear });
  assertSameYear(rules, inputs);
  const out: Recommendation[] = [];
  const baseline = liabilityWith(rules, inputs, r);
  const ownAnnual = dec(r.ownRetirementAnnual).plus(r.privateRaAnnual);
  const ownMonthly = dec(inputs.retirement?.ownMonthly ?? 0);
  const raMonthly = dec(inputs.retirement?.privateRaMonthly ?? 0);

  // Room left under Section 11F, counting the employer's contributions too.
  const roomAnnual = Decimal.max(dec(r.retirement.limitAnnual).minus(r.retirement.poolAnnual), 0);
  const roomMonthlyWhole = roomAnnual.dividedBy(12).floor();

  // R1 and R2: more retirement saving (or a first contribution).
  const retirementExample = (wanted: number) => {
    const extra = Decimal.min(wanted, roomMonthlyWhole);
    if (extra.lessThan(MIN_EXAMPLE_MONTHLY)) return null;
    const saving = baseline.minus(
      liabilityWith(rules, inputs, r, withOwnRetirement(ownMonthly.plus(extra).toNumber(), raMonthly.toNumber())),
    );
    if (saving.lessThanOrEqualTo(0)) return null;
    return {
      roomAnnual: toCents(roomAnnual),
      extraMonthly: extra.toNumber(),
      monthlySaving: monthly(saving),
      annualSaving: toCents(saving),
    };
  };
  if (ownAnnual.isZero()) {
    const e = retirementExample(R2_EXAMPLE_MONTHLY);
    if (e) out.push({ id: "R2", confidence: "CALCULATED", ...e });
  } else {
    const e = retirementExample(R1_EXAMPLE_MONTHLY);
    if (e) out.push({ id: "R1", confidence: "CALCULATED", ...e });
  }

  // R9: in a top bracket, so each rand saved is worth the most.
  if (r.marginalRate >= rules.guidance.topBracketRate && roomMonthlyWhole.greaterThanOrEqualTo(MIN_EXAMPLE_MONTHLY)) {
    out.push({ id: "R9", confidence: "CALCULATED", marginalRate: r.marginalRate, centsPerRand: Math.round(r.marginalRate * 100) });
  }

  // R3: a medical credit is in play. R4: no medical aid, so a credit is on offer.
  if (r.medical6A.annualCredit > 0) {
    out.push({
      id: "R3",
      confidence: "CALCULATED",
      monthlyCredit: r.medical6A.monthlyCredit,
      claimedOnFiling: r.notes.includes("MEDICAL_CREDIT_CLAIMED_ON_FILING"),
    });
  } else if (!(inputs.medical?.member ?? false)) {
    const usable = Decimal.min(rules.medical6A.monthlyMain, baseline.dividedBy(12));
    if (usable.greaterThan(0)) {
      out.push({ id: "R4", confidence: "CALCULATED", monthlyCredit: rules.medical6A.monthlyMain, usableMonthly: round2(usable).toNumber() });
    }
  }

  // R5: no donations yet.
  if (r.donations.givenAnnual === 0) {
    const room = dec(r.taxableIncome).times(rules.donations18A.limitRate);
    if (room.greaterThanOrEqualTo(R5_EXAMPLE_DONATION)) {
      const saving = baseline.minus(liabilityWith(rules, inputs, r, withDonations(R5_EXAMPLE_DONATION)));
      if (saving.greaterThan(0)) {
        out.push({
          id: "R5",
          confidence: "CALCULATED",
          exampleAnnual: R5_EXAMPLE_DONATION,
          annualSaving: toCents(saving),
          limitRate: rules.donations18A.limitRate,
        });
      }
    }
  }

  // R8: out-of-pocket medical costs might earn a credit.
  const medicalContext = (inputs.medical?.member ?? false) || (inputs.medical?.disabilityInFamily ?? false);
  if (medicalContext && r.medical6B.status === "NOT_PROVIDED") out.push({ id: "R8", confidence: "ESTIMATED" });

  // R6: interest near or over the exemption. R7: otherwise, tax-free savings in general.
  const nearInterest =
    r.interest.localAnnual > 0 && r.interest.localAnnual >= r.interest.exemptionAnnual * INTEREST_NEAR_SHARE;
  const tfsa = { tfsaAnnual: rules.tfsa.annualLimit, tfsaLifetime: rules.tfsa.lifetimeLimit };
  if (nearInterest) {
    out.push({
      id: "R6",
      confidence: "INFORMATIONAL",
      exemptionAnnual: rules.interestExemption.under65,
      exemptionAge65: rules.interestExemption.age65plus,
      interestAnnual: r.interest.localAnnual,
      ...tfsa,
    });
  } else {
    out.push({ id: "R7", confidence: "INFORMATIONAL", ...tfsa });
  }

  return out;
}
