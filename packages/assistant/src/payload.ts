import type { CalculationResult, Explanation, Recommendation, TaxRuleSet } from "@taxclarity/tax-engine";
import type { AssistantPayload } from "./types.ts";

/**
 * Builds the one object the assistant may see (PRD §15.2.3). Every field is named here on purpose; nothing is
 * copied across by spreading, so a new field added to the calculator's result never reaches the assistant by accident.
 */
export function buildPayload(input: {
  rules: TaxRuleSet;
  result: CalculationResult;
  explanations: readonly Explanation[];
  recommendations: readonly Recommendation[];
}): AssistantPayload {
  const { rules, result: r } = input;
  return {
    taxYear: rules.label,
    mode: r.mode,
    confidence: r.confidence,
    ageBand: r.ageBand,
    payFrequency: r.payFrequency,
    figures: {
      grossMonthly: r.grossMonthly,
      grossAnnual: r.grossAnnual,
      takeHomeMonthly: r.takeHomeMonthly,
      takeHomeAnnual: r.takeHomeAnnual,
      monthlyPaye: r.monthlyPaye,
      annualPaye: r.annualPaye,
      annualLiability: r.annualLiability,
      taxableIncome: r.taxableIncome,
      annualTaxBeforeRebates: r.annualTaxBeforeRebates,
      rebatesTotal: r.rebates.total,
      taxAfterRebates: r.taxAfterRebates,
      medicalCreditMonthly: r.medical6A.monthlyCredit,
      medicalCreditApplied: r.medical6A.appliedAnnual,
      uifMonthly: r.uifMonthly,
      uifAnnual: r.uifAnnual,
      ownRetirementMonthly: r.ownRetirementMonthly,
      privateRaMonthly: r.privateRaMonthly,
      ownMedicalMonthly: r.ownMedicalMonthly,
      variablePayAnnual: r.variablePay.totalAnnual,
      variablePayTaxAnnual: r.variablePay.taxAnnual,
      effectiveRate: r.effectiveRate,
      marginalRate: r.marginalRate,
      taxThreshold: r.taxThreshold,
      refundAnnual: r.filing.refundAnnual,
      owedAnnual: r.filing.owedAnnual,
    },
    bracketWalk: r.bracketWalk.map((b) => ({
      from: b.from,
      to: b.to,
      rate: b.rate,
      amountInBracket: b.amountInBracket,
      taxInBracket: b.taxInBracket,
      runningTotal: b.runningTotal,
      isTopBracket: b.isTopBracket,
    })),
    comparison: r.comparison
      ? {
          payslipPaye: r.comparison.payslipPaye,
          calcPaye: r.comparison.calcPaye,
          diff: r.comparison.diff,
          closeMatch: r.comparison.closeMatch,
        }
      : null,
    explanations: input.explanations.map((e) => ({ ...e })),
    recommendations: input.recommendations.map((x) => ({ ...x })),
    rules: {
      uifMaxMonthly: rules.uif.maxMonthlyEmployee,
      retirementRate: rules.retirement11F.rate,
      retirementAnnualCap: rules.retirement11F.annualCap,
      medicalMain: rules.medical6A.monthlyMain,
      medicalFirstDependant: rules.medical6A.monthlyFirstDep,
      medicalAdditional: rules.medical6A.monthlyAdditionalDep,
      rebatePrimary: rules.rebates.primary,
      rebateSecondary: rules.rebates.secondary65,
      rebateTertiary: rules.rebates.tertiary75,
      interestExemptionUnder65: rules.interestExemption.under65,
      interestExemption65Plus: rules.interestExemption.age65plus,
      tfsaAnnual: rules.tfsa.annualLimit,
      tfsaLifetime: rules.tfsa.lifetimeLimit,
      donationsLimitRate: rules.donations18A.limitRate,
    },
  };
}
