import { test } from "@playwright/test";
import type { CalculationInputs } from "@taxclarity/tax-engine";
import { expectResult, fillExtras, Wizard, type ExtrasOptions } from "./driver";

/**
 * A smaller matrix: age bands and the optional steps, each entered through the screens.
 * The expected figures are the engine's for the same inputs, so a mismatch means the screens
 * passed something different from what the person typed.
 */
interface Case {
  name: string;
  run: Parameters<Wizard["run"]>[0];
  extras?: ExtrasOptions;
  inputs: CalculationInputs;
}

const cases: Case[] = [
  {
    name: "65 to 74, pension, shared medical aid by debit order, donations",
    run: {
      mode: "gross",
      amount: "40000",
      age: "65 to 74",
      retirement: { payslip: "2000" },
      medical: { members: 2, total: "4000", paidBy: "We share it", employerShare: "1500", via: "By debit order" },
    },
    extras: { donations: "3000" },
    inputs: {
      mode: "GROSS",
      amount: 40_000,
      ageBand: "AGE_65_74",
      retirement: { ownMonthly: 2_000, employerMonthly: 0 },
      medical: { member: true, members: 2, monthlyContribution: 4_000, paidBy: "SHARED", employerMonthly: 1_500, ownSharePaidVia: "DEBIT_ORDER" },
      advanced: { donations18AAnnual: 3_000 },
    },
  },
  {
    name: "75 or older, a plain pension income",
    run: { mode: "gross", amount: "25000", age: "75 or older" },
    inputs: { mode: "GROSS", amount: 25_000, ageBand: "AGE_75_PLUS" },
  },
  {
    name: "weekly pay with the payslip PAYE",
    run: { mode: "payslip", amount: "7000", frequency: "Weekly", payslip: { paye: "1100", uif: "70" } },
    inputs: { mode: "PAYSLIP", amount: 7_000, payFrequency: "WEEKLY", ageBand: "UNDER_65", payslip: { payePerPeriod: 1_100, uifPerPeriod: 70 } },
  },
  {
    name: "fortnightly bank deposit",
    run: { mode: "take-home", amount: "11000", frequency: "Every two weeks" },
    inputs: { mode: "TAKE_HOME", amount: 11_000, payFrequency: "FORTNIGHTLY", ageBand: "UNDER_65" },
  },
  {
    name: "bonus, overtime and commission",
    run: { mode: "gross", amount: "35000", variable: { bonus: "35000", overtime: "12000", commission: "20000" } },
    inputs: { mode: "GROSS", amount: 35_000, ageBand: "UNDER_65", variablePay: { bonusAnnual: 35_000, overtimeAnnual: 12_000, commissionAnnual: 20_000 } },
  },
  {
    name: "employer contributes to retirement, and a retirement annuity by debit order",
    run: { mode: "gross", amount: "50000", retirement: { payslip: "3000", employer: "2500", ra: "2000" } },
    inputs: {
      mode: "GROSS",
      amount: 50_000,
      ageBand: "UNDER_65",
      retirement: { ownMonthly: 3_000, employerMonthly: 2_500, privateRaMonthly: 2_000 },
    },
  },
  {
    name: "extras: donations, interest, travel allowance with kilometres, a second job",
    run: { mode: "gross", amount: "45000" },
    extras: { donations: "5000", interest: "40000", travel: "4000", km: "9000", secondJob: "150000" },
    inputs: {
      mode: "GROSS",
      amount: 45_000,
      ageBand: "UNDER_65",
      advanced: {
        donations18AAnnual: 5_000,
        localInterestAnnual: 40_000,
        travelAllowanceMonthly: 4_000,
        travelBusinessKmAnnual: 9_000,
        hasSecondEmployer: true,
        secondEmployerAnnualGross: 150_000,
      },
    },
  },
  {
    name: "a low earner below the tax threshold",
    run: { mode: "gross", amount: "6000" },
    inputs: { mode: "GROSS", amount: 6_000, ageBand: "UNDER_65" },
  },
  {
    name: "a high earner in the top brackets",
    run: { mode: "gross", amount: "180000", retirement: { payslip: "30000" } },
    inputs: { mode: "GROSS", amount: 180_000, ageBand: "UNDER_65", retirement: { ownMonthly: 30_000, employerMonthly: 0 } },
  },
];

for (const c of cases) {
  test(c.name, async ({ page }) => {
    const w = new Wizard(page);
    const extras = c.extras;
    await w.run({ ...c.run, ...(extras ? { extras: () => fillExtras(w, extras) } : {}) });
    await expectResult(page, c.inputs);
  });
}
