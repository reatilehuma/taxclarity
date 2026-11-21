import { calculate, CurrentTaxRules as rules, type CalculationInputs } from "@taxclarity/tax-engine";

/**
 * The example shown on the landing page (PRD §13.1: sample data, clearly labelled).
 * The figures come from the real engine, so the example can never disagree with the calculator.
 */
export const EXAMPLE_INPUTS: CalculationInputs = {
  mode: "GROSS",
  amount: 32_000,
  ageBand: "UNDER_65",
  retirement: { ownMonthly: 2_400, employerMonthly: 0, fundTypes: ["PENSION"] },
  medical: { member: true, members: 2, monthlyContribution: 3_600, paidBy: "SELF" },
};

export const EXAMPLE_RESULT = calculate(rules, EXAMPLE_INPUTS);
